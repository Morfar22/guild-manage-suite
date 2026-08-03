// @ts-nocheck
// Migrated from Supabase Edge Function `tebex-webhook` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

__serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = __env("SUPABASE_URL")!;
    const supabaseKey = __env("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const guildId = url.searchParams.get("guild_id");

    if (!guildId) {
      return new Response(JSON.stringify({ error: "guild_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the guild has tebex enabled
    const { data: settings } = await supabase
      .from("tebex_settings")
      .select("enabled, webhook_secret, notification_channel_id")
      .eq("guild_id", guildId)
      .maybeSingle();

    if (!settings?.enabled) {
      return new Response(JSON.stringify({ error: "Tebex not enabled" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const eventType = body.type || "payment.completed";
    const subject = body.subject || {};

    // Extract payment info
    const txnId = subject.transaction_id || subject.id || String(Date.now());
    const customer = subject.customer || {};
    const products = subject.products || [];
    const price = subject.price || subject.amount || {};

    const purchaseRecord = {
      guild_id: guildId,
      txn_id: txnId,
      status: mapEventToStatus(eventType),
      amount: parseFloat(price.amount || price || "0"),
      currency: price.currency || "USD",
      player_name: customer.username || customer.name || null,
      player_uuid: customer.uuid || customer.id || null,
      player_discord_id: extractDiscordId(customer),
      packages: products.map((p: Record<string, unknown>) => ({
        id: p.id,
        name: p.name,
        quantity: p.quantity || 1,
      })),
      event_type: eventType,
      raw_payload: body,
    };

    // Store the purchase
    const { error: insertError } = await supabase
      .from("tebex_purchases")
      .insert(purchaseRecord);

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    // If it's a completed payment, check for role mappings
    if (eventType === "payment.completed" && purchaseRecord.player_discord_id) {
      await handleRoleGrant(supabase, guildId, products, purchaseRecord.player_discord_id);
    }

    // Notify Discord via bot if notification channel is set
    if (settings.notification_channel_id) {
      await notifyDiscord(supabase, guildId, settings.notification_channel_id, eventType, purchaseRecord);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Tebex webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapEventToStatus(eventType: string): string {
  switch (eventType) {
    case "payment.completed": return "complete";
    case "payment.refunded": return "refunded";
    case "payment.chargeback": return "chargeback";
    case "payment.dispute": return "disputed";
    default: return eventType;
  }
}

function extractDiscordId(customer: Record<string, unknown>): string | null {
  // Tebex can include integrations or custom fields with Discord ID
  if (customer.discord_id) return String(customer.discord_id);
  const integrations = customer.integrations as Record<string, unknown>[] | undefined;
  if (Array.isArray(integrations)) {
    const discord = integrations.find((i) => i.integration === "discord" || i.type === "discord");
    if (discord) return String(discord.id || discord.identifier);
  }
  return null;
}

async function handleRoleGrant(
  supabase: ReturnType<typeof createClient>,
  guildId: string,
  products: Array<Record<string, unknown>>,
  discordUserId: string
) {
  const packageIds = products.map((p) => Number(p.id)).filter(Boolean);
  if (packageIds.length === 0) return;

  const { data: mappings } = await supabase
    .from("tebex_role_mappings")
    .select("discord_role_id")
    .eq("guild_id", guildId)
    .in("tebex_package_id", packageIds);

  if (!mappings || mappings.length === 0) return;

  // Queue role grants via the bot's command queue
  for (const mapping of mappings) {
    await supabase.from("fivem_command_queue").insert({
      guild_id: guildId,
      command_name: "tebex_role_grant",
      command_data: {
        discord_user_id: discordUserId,
        role_id: mapping.discord_role_id,
      },
      moderator_discord_id: "system",
      moderator_name: "Tebex Webhook",
      status: "pending",
    });
  }
}

async function notifyDiscord(
  supabase: ReturnType<typeof createClient>,
  guildId: string,
  channelId: string,
  eventType: string,
  purchase: Record<string, unknown>
) {
  const emoji = eventType === "payment.completed" ? "🛒" :
    eventType === "payment.refunded" ? "↩️" :
    eventType === "payment.chargeback" ? "⚠️" : "📋";

  const title = eventType === "payment.completed" ? "Nyt køb!" :
    eventType === "payment.refunded" ? "Refusion" :
    eventType === "payment.chargeback" ? "Chargeback" : eventType;

  const pkgs = purchase.packages as Array<Record<string, unknown>> || [];

  // Store as a log event the bot can pick up
  await supabase.from("fivem_command_queue").insert({
    guild_id: guildId,
    command_name: "tebex_notification",
    command_data: {
      channel_id: channelId,
      embed: {
        title: `${emoji} ${title}`,
        color: eventType === "payment.completed" ? 0x2ecc71 : 0xe74c3c,
        fields: [
          { name: "Transaktions-ID", value: String(purchase.txn_id), inline: true },
          { name: "Beløb", value: `${purchase.amount} ${purchase.currency}`, inline: true },
          { name: "Spiller", value: String(purchase.player_name || "Ukendt"), inline: true },
          { name: "Pakker", value: pkgs.map((p) => p.name).join(", ") || "Ingen", inline: false },
        ],
        timestamp: new Date().toISOString(),
      },
    },
    moderator_discord_id: "system",
    moderator_name: "Tebex Webhook",
    status: "pending",
  });
}


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/tebex-webhook')({
  server: {
    handlers: {
      GET: __call,
      POST: __call,
      PUT: __call,
      PATCH: __call,
      DELETE: __call,
      OPTIONS: __call,
    },
  },
})
