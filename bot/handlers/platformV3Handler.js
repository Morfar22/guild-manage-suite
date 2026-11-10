"use strict";

const { Events } = require("discord.js");
const { botLog } = require("../consoleLogger");
const {
  operationalRpc,
  runOperationalJob,
  permanentOperationalError,
  isPermanentDiscordError,
  workflowMessageOptions,
  WorkflowEventSpool,
} = require("../utils/operationalJobs");
const EVENT_POLL_MS = Number(process.env.PLATFORM_V3_EVENT_POLL_MS || 10_000);
const HEALTH_SCAN_MS = Number(
  process.env.PLATFORM_V3_HEALTH_SCAN_MS || 300_000,
);
const SLA_SCAN_MS = Number(process.env.PLATFORM_V3_SLA_SCAN_MS || 60_000);
const sharedSpools = new WeakMap();

function renderWorkflowText(value, context) {
  if (typeof value !== "string") return value;
  return value
    .replace(
      /\{user\}/g,
      context.userId ? `<@${context.userId}>` : "ukendt bruger",
    )
    .replace(/\{username\}/g, context.username || context.userId || "ukendt")
    .replace(/\{server\}/g, context.guildName || "serveren")
    .replace(
      /\{channel\}/g,
      context.channelId ? `<#${context.channelId}>` : "ukendt kanal",
    )
    .replace(/\{command\}/g, context.commandName || "")
    .replace(/\{ticket\}/g, context.ticketId || "");
}

async function ownedGuildRecords(client, supabase, shouldHandleGuild) {
  if (!client.isReady?.()) return [];
  const ids = [...client.guilds.cache.keys()].filter(shouldHandleGuild);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("guilds")
    .select("id,guild_id,guild_name")
    .in("guild_id", ids);
  if (error) throw error;
  return data || [];
}

async function executeWorkflowJob(
  client,
  supabase,
  initialJob,
  guard = () => {},
) {
  let job = initialJob;
  const context = job.trigger_payload;
  const guild =
    client.guilds.cache.get(context.guildId) ||
    (await client.guilds.fetch(context.guildId));
  if (!guild)
    throw permanentOperationalError("Workflowets Discord-server findes ikke");
  while (job.action_index < job.actions.length) {
    guard();
    const index = job.action_index;
    const action = job.actions[index];
    if (!action?.type)
      throw permanentOperationalError("Ugyldig workflowhandling");
    job = await operationalRpc(supabase, "bot_workflow_action", {
      p_id: job.id,
      p_token: job.lease_token,
      p_index: index,
      p_phase: "begin",
      p_record: null,
    });
    let record = null;
    let sendStarted = false;
    try {
      if (action.type === "send_message") {
        const channelId = action.channel_id || context.channelId;
        if (!channelId)
          throw permanentOperationalError("Workflowet mangler en kanal");
        const channel =
          guild.channels.cache.get(channelId) ||
          (await guild.channels.fetch(channelId));
        if (!channel?.isTextBased?.())
          throw permanentOperationalError(
            "Workflowkanalen findes ikke eller kan ikke modtage beskeder",
          );
        guard();
        sendStarted = true;
        await channel.send({
          content: renderWorkflowText(
            action.message || "Workflow triggered",
            context,
          ),
          ...workflowMessageOptions(job.id, index),
        });
      } else if (action.type === "dm") {
        if (!context.userId)
          throw permanentOperationalError("Workflowet mangler en målbruger");
        const user = await client.users.fetch(context.userId);
        guard();
        sendStarted = true;
        await user.send({
          content: renderWorkflowText(
            action.message || "Workflow triggered",
            context,
          ),
          ...workflowMessageOptions(job.id, index),
        });
      } else if (action.type === "add_role" || action.type === "remove_role") {
        if (!context.userId || !action.role_id)
          throw permanentOperationalError(
            "Workflowet mangler en bruger eller rolle",
          );
        const member = await guild.members.fetch(context.userId);
        guard();
        if (action.type === "add_role")
          await member.roles.add(
            action.role_id,
            `Workflow: ${job.workflow_name}`,
          );
        else
          await member.roles.remove(
            action.role_id,
            `Workflow: ${job.workflow_name}`,
          );
      } else if (action.type === "dashboard_alert") {
        record = {
          severity: action.severity || "info",
          title: renderWorkflowText(
            action.title || `Workflow: ${job.workflow_name}`,
            context,
          ),
          message: renderWorkflowText(
            action.message || `Trigger: ${job.trigger_type}`,
            context,
          ),
        };
      } else if (action.type === "create_case") {
        if (!context.userId)
          throw permanentOperationalError("Workflowet mangler en sagsbruger");
        record = {
          moderator_id: client.user.id,
          moderator_name: client.user.tag,
          severity: action.severity || "medium",
          reason: renderWorkflowText(
            action.reason || `Workflow: ${job.workflow_name}`,
            context,
          ),
        };
      } else
        throw permanentOperationalError(
          `Ukendt workflowhandling: ${action.type}`,
        );
    } catch (error) {
      // Nonces do not provide a durable exactly-once guarantee after an
      // ambiguous message request. Require review rather than repeating it.
      if (
        sendStarted &&
        !error.database &&
        !isPermanentDiscordError(error) &&
        Number(error.status || error.code) !== 429
      ) {
        error.permanent = true;
        error.message = `Discord-resultatet er ukendt. Kontrollér Discord før workflowet gentages. ${error.message || ""}`;
      }
      throw error;
    }
    guard();
    // Database effects and their checkpoint commit together. A missing
    // acknowledgement leaves the lease intact so recovery can inspect it.
    job = await operationalRpc(supabase, "bot_workflow_action", {
      p_id: job.id,
      p_token: job.lease_token,
      p_index: index,
      p_phase: "complete",
      p_record: record,
    });
  }
}

async function processWorkflowJobs(
  client,
  supabase,
  guilds,
  shouldHandleGuild,
) {
  for (const guild of guilds) {
    if (!shouldHandleGuild(guild.guild_id)) continue;
    try {
      await operationalRpc(supabase, "bot_ingest_workflow_events", {
        p_guild_id: guild.id,
      });
      const { data, error } = await supabase
        .from("bot_workflow_jobs")
        .select("*")
        .eq("guild_id", guild.id)
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      for (const candidate of data || []) {
        try {
          await runOperationalJob(
            supabase,
            "workflow",
            candidate.id,
            (job, guard) => executeWorkflowJob(client, supabase, job, guard),
          );
        } catch (error) {
          if (!error.operationalLogged)
            botLog(guild.id, "error", "workflows", error.message, {
              job_id: candidate.id,
            });
          console.error(
            "[PlatformV3] Workflow recovery/acknowledgement failed:",
            error.message,
          );
        }
      }
    } catch (error) {
      botLog(
        guild.id,
        "error",
        "workflows",
        `Workflow ingestion failed: ${error.message}`,
        { operation: "ingest" },
      );
      console.error(
        "[PlatformV3] Guild workflow ingestion failed:",
        error.message,
      );
    }
  }
}

async function scanCommandHealth(supabase, guilds) {
  if (!guilds.length) return;
  const { data, error } = await supabase
    .from("command_health_7d")
    .select("*")
    .in(
      "guild_id",
      guilds.map((g) => g.id),
    )
    .gte("executions", 5)
    .gte("error_rate", 25);
  if (error) throw error;
  for (const row of data || []) {
    await operationalRpc(supabase, "bot_upsert_operational_alert", {
      p_guild_id: row.guild_id,
      p_source: "command-health",
      p_key: row.command_name,
      p_title: `Command health: ${row.command_name}`,
      p_message: `${row.error_rate}% fejlrate over ${row.executions} executions. Gns. latency ${row.avg_latency_ms || 0} ms.`,
      p_severity: Number(row.error_rate || 0) >= 50 ? "critical" : "warning",
      p_metadata: {
        command_name: row.command_name,
        error_rate: row.error_rate,
        executions: row.executions,
        avg_latency_ms: row.avg_latency_ms,
      },
    });
  }
}

async function scanTicketSla(supabase, guilds) {
  if (!guilds.length) return;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("tickets")
    .select("id,guild_id,creator_name,subject,sla_due_at")
    .in(
      "guild_id",
      guilds.map((g) => g.id),
    )
    .is("closed_at", null)
    .is("escalated_at", null)
    .not("sla_due_at", "is", null)
    .lte("sla_due_at", now)
    .limit(100);
  if (error) throw error;
  for (const ticket of data || []) {
    await operationalRpc(supabase, "bot_upsert_operational_alert", {
      p_guild_id: ticket.guild_id,
      p_source: "ticket-sla",
      p_key: ticket.id,
      p_title: "Ticket SLA overskredet",
      p_message: `${ticket.creator_name || "Bruger"} · ${ticket.subject || ticket.id}`,
      p_severity: "warning",
      p_metadata: { ticket_id: ticket.id, sla_due_at: ticket.sla_due_at },
    });
    const { error: updateError } = await supabase
      .from("tickets")
      .update({ escalated_at: now, updated_at: now })
      .eq("id", ticket.id)
      .is("escalated_at", null);
    if (updateError) throw updateError;
  }
}

function setupPlatformV3Handler(client, supabase, options = {}) {
  const shouldHandleGuild = options.shouldHandleGuild || (() => true);
  if (!sharedSpools.has(supabase))
    sharedSpools.set(supabase, new WorkflowEventSpool(supabase));
  const spool = options.spool || sharedSpools.get(supabase);
  let disposed = false;
  const busy = new Set();
  const safeTick = async (name, operation) => {
    if (disposed || busy.has(name)) return;
    busy.add(name);
    try {
      await operation();
    } catch (error) {
      console.error(`[PlatformV3] ${name} failed:`, error.message);
    } finally {
      busy.delete(name);
    }
  };
  const capture = async (triggerType, eventKey, payload) => {
    if (disposed) return;
    try {
      await spool.persist({
        trigger_type: triggerType,
        event_key: eventKey,
        payload,
      });
      await spool.drain();
    } catch (error) {
      console.error(
        "[PlatformV3] Gateway event enqueue failed:",
        error.message,
      );
    }
  };
  const memberJoined = (member) => {
    if (!member.guild || !shouldHandleGuild(member.guild.id)) return;
    const occurred = member.joinedTimestamp || Date.now();
    void capture(
      "member_join",
      `member:${member.guild.id}:${member.id}:${occurred}`,
      {
        userId: member.id,
        username: member.user.username,
        guildId: member.guild.id,
        guildName: member.guild.name,
        accountCreatedAt: member.user.createdAt?.toISOString?.() || null,
        eventOccurredAt: new Date(occurred).toISOString(),
      },
    );
  };
  const messageCreated = (message) => {
    if (
      !message.guild ||
      message.author.bot ||
      !shouldHandleGuild(message.guild.id)
    )
      return;
    void capture("message_keyword", `message:${message.id}`, {
      userId: message.author.id,
      username: message.author.username,
      guildId: message.guild.id,
      guildName: message.guild.name,
      channelId: message.channel.id,
      messageId: message.id,
      messageContent: message.content,
      eventOccurredAt: new Date(
        message.createdTimestamp || Date.now(),
      ).toISOString(),
    });
  };
  client.on(Events.GuildMemberAdd, memberJoined);
  client.on(Events.MessageCreate, messageCreated);
  const poll = () =>
    safeTick("workflow poll", async () => {
      await spool.drain();
      const guilds = await ownedGuildRecords(
        client,
        supabase,
        shouldHandleGuild,
      );
      await processWorkflowJobs(client, supabase, guilds, shouldHandleGuild);
    });
  const health = () =>
    safeTick("command health", async () =>
      scanCommandHealth(
        supabase,
        await ownedGuildRecords(client, supabase, shouldHandleGuild),
      ),
    );
  const sla = () =>
    safeTick("ticket SLA", async () =>
      scanTicketSla(
        supabase,
        await ownedGuildRecords(client, supabase, shouldHandleGuild),
      ),
    );
  const intervals = [
    setInterval(() => void poll(), EVENT_POLL_MS),
    setInterval(() => void health(), HEALTH_SCAN_MS),
    setInterval(() => void sla(), SLA_SCAN_MS),
  ];
  const initial = [
    setTimeout(() => void poll(), 3_000),
    setTimeout(() => void health(), 8_000),
    setTimeout(() => void sla(), 10_000),
  ];
  console.log("[PlatformV3] Durable workflow/alert engine initialized");
  return {
    destroy() {
      disposed = true;
      intervals.forEach(clearInterval);
      initial.forEach(clearTimeout);
      client.removeListener?.(Events.GuildMemberAdd, memberJoined);
      client.removeListener?.(Events.MessageCreate, messageCreated);
    },
  };
}

module.exports = {
  setupPlatformV3Handler,
  executeWorkflowJob,
  processWorkflowJobs,
  ownedGuildRecords,
  scanCommandHealth,
  scanTicketSla,
};
