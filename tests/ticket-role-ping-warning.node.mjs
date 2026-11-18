import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const originalLoad = Module._load;

function loadTicketHandler() {
  Module._load = function mockTicketHandlerDependencies(
    request,
    parent,
    isMain,
  ) {
    if (request === "discord.js") return {};
    if (request === "../commandRouting") {
      return { resolveInteractionCommand: () => null };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  process.env.BOT_SECRET_KEY = "ticket-warning-test";
  const handlerPath = require.resolve("../bot/handlers/ticketHandler.js");
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  Module._load = originalLoad;
  return handler;
}

function query(data) {
  return {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data, error: null });
    },
  };
}

test("ticket role-ping warning applies without checking the sender rank", async () => {
  const listeners = new Map();
  const client = {
    on(event, listener) {
      listeners.set(event, listener);
    },
  };
  const supabase = {
    from(table) {
      if (table === "tickets") return query({ guild_id: "guild-record" });
      if (table === "ticket_settings") {
        return query({ role_ping_warning_role_ids: ["protected-role"] });
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    fetchCalls.push(JSON.parse(init.body));
    return Response.json({ success: true });
  };

  try {
    const { setupTicketHandler } = loadTicketHandler();
    setupTicketHandler(client, { supabase });

    const replies = [];
    await listeners.get("messageCreate")({
      author: { id: "staff-user", username: "Staff", bot: false },
      guild: { id: "discord-guild" },
      channel: { id: "ticket-channel", isThread: () => true },
      content: "Please help",
      attachments: new Map(),
      mentions: { roles: new Map([["protected-role", { id: "protected-role" }]]) },
      reply(payload) {
        replies.push(payload);
        return Promise.resolve();
      },
    });

    assert.equal(fetchCalls[0].action, "saveMessage");
    assert.deepEqual(replies, [
      {
        content: "⚠️ Undlad venligst at tagge denne rolle i tickets.",
        allowedMentions: { parse: [], repliedUser: false },
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    Module._load = originalLoad;
  }
});

test("ticket user-ping warning uses the configured Discord user ID", async () => {
  const listeners = new Map();
  const client = {
    on(event, listener) {
      listeners.set(event, listener);
    },
  };
  const supabase = {
    from(table) {
      if (table === "tickets") return query({ guild_id: "guild-record" });
      if (table === "ticket_settings") {
        return query({ user_ping_warning_user_ids: ["protected-user"] });
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ success: true });

  try {
    const { setupTicketHandler } = loadTicketHandler();
    setupTicketHandler(client, { supabase });

    const replies = [];
    await listeners.get("messageCreate")({
      author: { id: "admin-user", username: "Admin", bot: false },
      guild: { id: "discord-guild" },
      channel: { id: "ticket-channel", isThread: () => true },
      content: "Please help",
      attachments: new Map(),
      mentions: {
        roles: new Map(),
        users: new Map([["protected-user", { id: "protected-user" }]]),
      },
      reply(payload) {
        replies.push(payload);
        return Promise.resolve();
      },
    });

    assert.equal(replies.length, 1);
    assert.deepEqual(replies[0].allowedMentions, {
      parse: [],
      repliedUser: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
    Module._load = originalLoad;
  }
});
