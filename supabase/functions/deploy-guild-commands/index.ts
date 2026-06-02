import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function simpleDecrypt(encoded: string, key: string): string {
  const text = atob(encoded);
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

async function getBotCredentialsForDiscordGuild(
  supabase: ReturnType<typeof createClient>,
  discordGuildId: string,
  fallbackToken: string,
  fallbackClientId: string,
) {
  const { data: guildRow, error: guildLookupError } = await supabase
    .from("guilds")
    .select("id")
    .eq("guild_id", discordGuildId)
    .maybeSingle();

  if (guildLookupError) {
    console.error("Failed to resolve guild for command deploy:", guildLookupError);
    return {
      botToken: fallbackToken,
      appId: fallbackClientId,
      isCustomBot: false,
    };
  }

  if (!guildRow?.id) {
    return {
      botToken: fallbackToken,
      appId: fallbackClientId,
      isCustomBot: false,
    };
  }

  const { data: settings, error: settingsError } = await supabase
    .from("guild_bot_settings")
    .select("is_custom_bot, is_active, bot_token_encrypted, bot_client_id, bot_name")
    .eq("guild_id", guildRow.id)
    .eq("is_custom_bot", true)
    .eq("is_active", true)
    .maybeSingle();

  if (settingsError) {
    console.error("Failed to fetch guild bot settings for command deploy:", settingsError);
    return {
      botToken: fallbackToken,
      appId: fallbackClientId,
      isCustomBot: false,
    };
  }

  const encryptionKey = Deno.env.get("BOT_SECRET_KEY");
  if (!settings?.bot_token_encrypted || !settings?.bot_client_id || !encryptionKey) {
    return {
      botToken: fallbackToken,
      appId: fallbackClientId,
      isCustomBot: false,
    };
  }

  try {
    return {
      botToken: simpleDecrypt(settings.bot_token_encrypted, encryptionKey),
      appId: settings.bot_client_id,
      isCustomBot: true,
      botName: settings.bot_name || undefined,
    };
  } catch (error) {
    console.error("Failed to decrypt custom bot token for command deploy:", error);
    return {
      botToken: fallbackToken,
      appId: fallbackClientId,
      isCustomBot: false,
    };
  }
}

// Full slash command definitions (mirrors bot/deployCommands.js)
const COMMANDS = [
  // MODERATION
  { name: "ban", description: "Ban en bruger fra serveren", options: [
    { name: "user", description: "Brugeren der skal bannes", type: 6, required: true },
    { name: "reason", description: "Årsag til ban", type: 3 },
    { name: "delete_messages", description: "Antal dage beskeder der skal slettes (0-7)", type: 4 },
  ]},
  { name: "unban", description: "Unban en bruger", options: [
    { name: "user_id", description: "Brugerens ID", type: 3, required: true },
    { name: "reason", description: "Årsag til unban", type: 3 },
  ]},
  { name: "kick", description: "Kick en bruger fra serveren", options: [
    { name: "user", description: "Brugeren der skal kickes", type: 6, required: true },
    { name: "reason", description: "Årsag til kick", type: 3 },
  ]},
  { name: "mute", description: "Mute en bruger", options: [
    { name: "user", description: "Brugeren der skal mutes", type: 6, required: true },
    { name: "duration", description: "Varighed i minutter (standard: 10)", type: 4 },
    { name: "reason", description: "Årsag til mute", type: 3 },
  ]},
  { name: "unmute", description: "Unmute en bruger", options: [
    { name: "user", description: "Brugeren der skal unmutes", type: 6, required: true },
  ]},
  { name: "warn", description: "Advar en bruger", options: [
    { name: "user", description: "Brugeren der skal advares", type: 6, required: true },
    { name: "reason", description: "Årsag til advarsel", type: 3, required: true },
  ]},
  { name: "warnings", description: "Se advarsler for en bruger", options: [
    { name: "user", description: "Brugeren", type: 6, required: true },
  ]},
  { name: "clear", description: "Slet beskeder i kanalen", options: [
    { name: "amount", description: "Antal beskeder (1-100)", type: 4, required: true },
    { name: "user", description: "Kun beskeder fra denne bruger", type: 6 },
  ]},
  { name: "slowmode", description: "Sæt slowmode på kanalen", options: [
    { name: "seconds", description: "Sekunder (0 = deaktiver)", type: 4, required: true },
  ]},
  { name: "lock", description: "Lås en kanal", options: [
    { name: "channel", description: "Kanalen der skal låses", type: 7 },
  ]},
  { name: "unlock", description: "Lås en kanal op", options: [
    { name: "channel", description: "Kanalen der skal låses op", type: 7 },
  ]},
  { name: "softban", description: "Softban en bruger (ban + unban for at slette beskeder)", options: [
    { name: "user", description: "Brugeren", type: 6, required: true },
    { name: "reason", description: "Årsag", type: 3 },
  ]},
  { name: "clearwarns", description: "Slet alle advarsler for en bruger", options: [
    { name: "user", description: "Brugeren", type: 6, required: true },
  ]},
  { name: "timeout", description: "Giv en bruger timeout", options: [
    { name: "user", description: "Brugeren", type: 6, required: true },
    { name: "duration", description: "Varighed i minutter (standard: 10)", type: 4 },
    { name: "reason", description: "Årsag", type: 3 },
  ]},
  { name: "untimeout", description: "Fjern timeout fra en bruger", options: [
    { name: "user", description: "Brugeren", type: 6, required: true },
  ]},
  { name: "nuke", description: "Slet alle beskeder i kanalen (genskaber kanalen)" },

  // MUSIC
  { name: "play", description: "Afspil musik", options: [
    { name: "query", description: "Sang eller URL", type: 3, required: true },
  ]},
  { name: "skip", description: "Skip den nuværende sang" },
  { name: "stop", description: "Stop musikken og forlad kanalen" },
  { name: "pause", description: "Pause musikken" },
  { name: "resume", description: "Genoptag musikken" },
  { name: "queue", description: "Se musikken i køen" },
  { name: "nowplaying", description: "Se den nuværende sang" },
  { name: "volume", description: "Juster lydstyrken", options: [
    { name: "level", description: "Lydstyrke (0-100)", type: 4, required: true },
  ]},
  { name: "loop", description: "Gentag sang eller kø", options: [
    { name: "mode", description: "off / track / queue", type: 3, required: true, choices: [
      { name: "Off", value: "off" }, { name: "Track", value: "track" }, { name: "Queue", value: "queue" },
    ]},
  ]},
  { name: "shuffle", description: "Bland køen" },

  // ==================== MUSIC QUIZ ====================
  { name: "musicquiz", description: "Musik Quiz - gæt sangen!", options: [
    { name: "start", description: "Start en musik quiz i quiz-kanalen", type: 1 },
    { name: "stop", description: "Stop den aktive quiz", type: 1 },
    { name: "skip", description: "Spring nuværende runde over", type: 1 },
    { name: "leaderboard", description: "Vis top spillere", type: 1 },
  ]},
  { name: "remove", description: "Fjern en sang fra køen", options: [
    { name: "position", description: "Position i køen", type: 4, required: true },
  ]},
  { name: "move", description: "Flyt en sang i køen", options: [
    { name: "from", description: "Fra position", type: 4, required: true },
    { name: "to", description: "Til position", type: 4, required: true },
  ]},
  { name: "jump", description: "Hop til en sang i køen", options: [
    { name: "position", description: "Position", type: 4, required: true },
  ]},

  // LEVELING
  { name: "rank", description: "Se din eller en brugers rank", options: [
    { name: "user", description: "Bruger (valgfri)", type: 6 },
  ]},
  { name: "leaderboard", description: "Se XP leaderboard" },

  // UTILITY
  { name: "help", description: "Se alle tilgængelige kommandoer", options: [
    { name: "category", description: "Kategori", type: 3, choices: [
      { name: "Moderation", value: "moderation" },
      { name: "Musik", value: "music" },
      { name: "Leveling", value: "leveling" },
      { name: "Utility", value: "utility" },
      { name: "Fun", value: "fun" },
      { name: "Economy", value: "economy" },
      { name: "Giveaway", value: "giveaway" },
      { name: "Suggestion", value: "suggestion" },
      { name: "AFK", value: "afk" },
      { name: "Tebex", value: "tebex" },
    ]},
  ]},
  { name: "ping", description: "Se bottens latency" },
  { name: "serverinfo", description: "Se info om serveren" },
  { name: "userinfo", description: "Se info om en bruger", options: [
    { name: "user", description: "Bruger (valgfri)", type: 6 },
  ]},
  { name: "avatar", description: "Se en brugers avatar", options: [
    { name: "user", description: "Bruger (valgfri)", type: 6 },
  ]},
  { name: "poll", description: "Opret en afstemning", options: [
    { name: "question", description: "Spørgsmål", type: 3, required: true },
    { name: "options", description: "Valgmuligheder adskilt med | (f.eks. Ja|Nej|Måske)", type: 3, required: true },
  ]},
  { name: "remind", description: "Sæt en påmindelse", options: [
    { name: "time", description: "Tid (f.eks. 10m, 1h, 1d)", type: 3, required: true },
    { name: "message", description: "Påmindelsesbesked", type: 3, required: true },
  ]},

  // TICKETS
  { name: "ticket", description: "Opret en ny ticket/support-sag" },
  { name: "ticket-remind", description: "Påmind ticket-ejeren om at svare (auto-sletning efter 12 timer)" },
  { name: "ticket-close", description: "Luk den aktuelle ticket", options: [
    { name: "delete", description: "Slet tråden i stedet for at arkivere", type: 5 },
  ]},
  { name: "ticket-claim", description: "Claim den aktuelle ticket som din" },
  { name: "ticket-add", description: "Tilføj en bruger til den aktuelle ticket", options: [
    { name: "user", description: "Brugeren der skal tilføjes", type: 6, required: true },
  ]},
  { name: "ticket-remove", description: "Fjern en bruger fra den aktuelle ticket", options: [
    { name: "user", description: "Brugeren der skal fjernes", type: 6, required: true },
  ]},

  // FUN
  { name: "8ball", description: "Spørg den magiske 8-ball", options: [
    { name: "question", description: "Dit spørgsmål", type: 3, required: true },
  ]},
  { name: "coinflip", description: "Slå plat eller krone" },
  { name: "dice", description: "Kast en terning", options: [
    { name: "sides", description: "Antal sider (standard: 6)", type: 4 },
  ]},
  { name: "rps", description: "Spil sten-saks-papir", options: [
    { name: "choice", description: "Dit valg", type: 3, required: true, choices: [
      { name: "Sten", value: "sten" }, { name: "Saks", value: "saks" }, { name: "Papir", value: "papir" },
    ]},
  ]},
  { name: "joke", description: "Få en tilfældig joke" },
  { name: "meme", description: "Få et tilfældigt meme" },
  { name: "ship", description: "Ship to brugere", options: [
    { name: "user1", description: "Første bruger", type: 6, required: true },
    { name: "user2", description: "Anden bruger", type: 6, required: true },
  ]},
  { name: "rate", description: "Bedøm noget", options: [
    { name: "thing", description: "Hvad skal bedømmes?", type: 3, required: true },
  ]},

  // ECONOMY
  { name: "daily", description: "Hent din daglige belønning" },
  { name: "work", description: "Arbejd for at tjene penge" },
  { name: "balance", description: "Se din eller en brugers balance", options: [
    { name: "user", description: "Bruger (valgfri)", type: 6 },
  ]},
  { name: "pay", description: "Betal en bruger", options: [
    { name: "user", description: "Modtager", type: 6, required: true },
    { name: "amount", description: "Beløb", type: 4, required: true },
  ]},
  { name: "deposit", description: "Indsæt penge i banken", options: [
    { name: "amount", description: "Beløb", type: 4, required: true },
  ]},
  { name: "withdraw", description: "Hæv penge fra banken", options: [
    { name: "amount", description: "Beløb", type: 4, required: true },
  ]},
  { name: "rob", description: "Røv en bruger", options: [
    { name: "user", description: "Bruger", type: 6, required: true },
  ]},
  { name: "richest", description: "Se de rigeste brugere" },

  // AFK
  { name: "afk", description: "Sæt din AFK status", options: [
    { name: "message", description: "AFK besked (valgfri)", type: 3 },
  ]},

  // TEBEX
  { name: "tebex-verify", description: "Verificer et Tebex køb", options: [
    { name: "transaction_id", description: "Transaktions-ID", type: 3, required: true },
  ]},

  // GIVEAWAY
  { name: "giveaway", description: "Administrer giveaways", options: [
    { name: "start", description: "Start en giveaway", type: 1, options: [
      { name: "prize", description: "Præmie", type: 3, required: true },
      { name: "duration", description: "Varighed (f.eks. 1h, 1d)", type: 3, required: true },
      { name: "winners", description: "Antal vindere (standard: 1)", type: 4 },
      { name: "description", description: "Beskrivelse", type: 3 },
    ]},
    { name: "end", description: "Afslut en giveaway tidligt", type: 1, options: [
      { name: "message_id", description: "Giveaway besked-ID", type: 3, required: true },
    ]},
    { name: "reroll", description: "Vælg nye vindere", type: 1, options: [
      { name: "message_id", description: "Giveaway besked-ID", type: 3, required: true },
    ]},
  ]},

  // SUGGESTION
  { name: "suggest", description: "Send et forslag", options: [
    { name: "suggestion", description: "Dit forslag", type: 3, required: true },
  ]},

  // GLOBAL BAN REPORT
  { name: "globalban-report", description: "Rapportér en bruger til det globale ban-system", options: [
    { name: "user", description: "Brugeren der skal rapporteres", type: 6, required: true },
    { name: "reason", description: "Årsag til rapporten", type: 3, required: true },
    { name: "severity", description: "Alvorlighed/kategori", type: 3, choices: [
      { name: "Cheating", value: "cheating" },
      { name: "Chikane", value: "harassment" },
      { name: "Scam", value: "scam" },
      { name: "Raiding", value: "raiding" },
      { name: "ToS Overtrædelse", value: "tos_violation" },
      { name: "Andet", value: "other" },
    ]},
    { name: "evidence", description: "Link til beviser (valgfri)", type: 3 },
  ]},

  // ADMIN / TEST
  { name: "testall", description: "Test alle bot-kommandoer og handlers (kun admin)", options: [
    { name: "verbose", description: "Vis detaljer for hver kommando", type: 5 },
  ]},
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hasAccess } = await supabase.rpc("has_admin_or_staff_role", {
      _user_id: user.id,
    });

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden — admin/staff only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { discordGuildId, mode = "deploy" } = body;

    const defaultBotToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const defaultAppId = Deno.env.get("DISCORD_CLIENT_ID");

    if (!defaultBotToken || !defaultAppId) {
      return new Response(
        JSON.stringify({ error: "Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID secret" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode: clear-global — removes all global commands (fixes duplicates)
    if (mode === "clear-global") {
      const res = await fetch(
        `https://discord.com/api/v10/applications/${defaultAppId}/commands`,
        {
          method: "PUT",
          headers: { Authorization: `Bot ${defaultBotToken}`, "Content-Type": "application/json" },
          body: JSON.stringify([]),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        return new Response(
          JSON.stringify({ error: `Failed to clear global commands (${res.status})`, details: txt }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, message: "Globale kommandoer ryddet. Discord cache kan tage op til 1 time at opdatere." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!discordGuildId || !/^\d{17,20}$/.test(String(discordGuildId))) {
      return new Response(JSON.stringify({ error: "Invalid guild ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { botToken, appId, isCustomBot, botName } = await getBotCredentialsForDiscordGuild(
      supabase,
      String(discordGuildId),
      defaultBotToken,
      defaultAppId,
    );

    const guildRes = await fetch(
      `https://discord.com/api/v10/applications/${appId}/guilds/${discordGuildId}/commands`,
      {
        method: "PUT",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(COMMANDS),
      }
    );

    if (!guildRes.ok) {
      const txt = await guildRes.text();
      let hint = "";
      if (guildRes.status === 403) {
        hint = isCustomBot
          ? ` Custom bot${botName ? ` (${botName})` : ""} mangler enten 'applications.commands' scope eller er ikke i denne guild. Geninvitér den med dette link: https://discord.com/api/oauth2/authorize?client_id=${appId}&scope=bot+applications.commands&permissions=8`
          : ` Botten mangler enten 'applications.commands' scope eller er ikke i denne guild. Geninvitér botten med dette link: https://discord.com/api/oauth2/authorize?client_id=${appId}&scope=bot+applications.commands&permissions=8`;
      }
      return new Response(
        JSON.stringify({ error: `Discord API error (${guildRes.status}).${hint}`, details: txt }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deployed = await guildRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        deployed: deployed.length,
        commands: deployed.map((c: any) => c.name),
        usingCustomBot: isCustomBot,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
