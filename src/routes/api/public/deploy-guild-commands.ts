// @ts-nocheck
// Migrated from Supabase Edge Function `deploy-guild-commands` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { groupFlatCommandDefinitions, canonicalLogicalCommands } from '@/lib/commandGrouping'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


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
  fallbackToken?: string,
  fallbackClientId?: string,
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

  const encryptionKey = __env("BOT_SECRET_KEY");
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
  { name: "purge", description: "Avanceret sletning af beskeder med filter", options: [
    { name: "amount", description: "Maks antal beskeder der skal slettes (1-100)", type: 4, required: true },
    { name: "filter", description: "Filtrer hvilke beskeder der slettes", type: 3, choices: [
      { name: "Alle", value: "all" },
      { name: "Bots", value: "bots" },
      { name: "Links", value: "links" },
      { name: "Embeds", value: "embeds" },
    ]},
    { name: "user", description: "Kun beskeder fra denne bruger", type: 6 },
  ]},
  { name: "massban", description: "Ban flere Discord bruger-ID'er på én gang", options: [
    { name: "users", description: "Bruger-ID'er adskilt med mellemrum eller komma", type: 3, required: true },
    { name: "reason", description: "Årsag", type: 3 },
    { name: "delete_messages", description: "Slet beskeder fra de seneste 0-7 dage", type: 4 },
  ]},
  { name: "case", description: "Vis en moderation case", options: [
    { name: "case_id", description: "Hele eller starten af case-ID'et", type: 3, required: true },
  ]},
  { name: "history", description: "Vis moderation-historik for en bruger", options: [
    { name: "user", description: "Brugeren", type: 6, required: true },
  ]},
  { name: "reason", description: "Skift årsagen på en moderation case", options: [
    { name: "case_id", description: "Hele eller starten af case-ID'et", type: 3, required: true },
    { name: "reason", description: "Ny årsag", type: 3, required: true },
  ]},
  { name: "note", description: "Tilføj en intern staff-note", options: [
    { name: "user", description: "Brugeren", type: 6, required: true },
    { name: "note", description: "Noten", type: 3, required: true },
    { name: "case_id", description: "Valgfrit case-ID", type: 3 },
  ]},
  { name: "tempban", description: "Ban en bruger midlertidigt", options: [
    { name: "user", description: "Brugeren", type: 6, required: true },
    { name: "duration", description: "Varighed i minutter", type: 4, required: true },
    { name: "reason", description: "Årsag", type: 3 },
  ]},
  { name: "role", description: "Tilføj eller fjern en rolle som moderation", options: [
    { name: "user", description: "Brugeren", type: 6, required: true },
    { name: "role", description: "Rollen", type: 8, required: true },
    { name: "action", description: "Handling", type: 3, required: true, choices: [
      { name: "Tilføj", value: "add" },
      { name: "Fjern", value: "remove" },
    ]},
    { name: "reason", description: "Årsag", type: 3 },
  ]},
  { name: "quarantine", description: "Tildel en quarantine-rolle", options: [
    { name: "user", description: "Brugeren", type: 6, required: true },
    { name: "role", description: "Quarantine-rollen", type: 8, required: true },
    { name: "duration", description: "Varighed i minutter, 0 eller tom = permanent", type: 4 },
    { name: "reason", description: "Årsag", type: 3 },
  ]},

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
      { name: "Tickets", value: "tickets" },
      { name: "Giveaway", value: "giveaway" },
      { name: "Tebex", value: "tebex" },
      { name: "Admin", value: "admin" },
      { name: "Reaction Roles", value: "reactionroles" },
    ]},
  ]},
  { name: "commands", description: "Se alle tilgængelige kommandoer (alias for /help)", options: [
    { name: "category", description: "Kategori", type: 3, choices: [
      { name: "Moderation", value: "moderation" },
      { name: "Musik", value: "music" },
      { name: "Leveling", value: "leveling" },
      { name: "Utility", value: "utility" },
      { name: "Fun", value: "fun" },
      { name: "Economy", value: "economy" },
      { name: "Tickets", value: "tickets" },
      { name: "Giveaway", value: "giveaway" },
      { name: "Tebex", value: "tebex" },
      { name: "Admin", value: "admin" },
      { name: "Reaction Roles", value: "reactionroles" },
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
  { name: "appeal-submit", description: "Indsend en moderation appeal", options: [
    { name: "message", description: "Forklar hvorfor sagen bør genovervejes", type: 3, required: true },
    { name: "case_id", description: "Valgfrit case-ID", type: 3 },
  ]},
  { name: "appeal-status", description: "Se status på dine appeals", options: [
    { name: "appeal_id", description: "Valgfrit appeal-ID", type: 3 },
  ]},
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

  // UTILITY (nye)
  { name: "uptime", description: "Se hvor længe botten har kørt" },
  { name: "stats", description: "Se statistik for serveren" },
  { name: "invite", description: "Få et invite-link til botten" },
  { name: "calculate", description: "Beregn et matematisk udtryk", options: [
    { name: "expression", description: "F.eks. (5+3)*2", type: 3, required: true },
  ]},
  { name: "channelinfo", description: "Vis info om en kanal", options: [
    { name: "channel", description: "Kanalen (standard: denne)", type: 7 },
  ]},
  { name: "roleinfo", description: "Vis info om en rolle", options: [
    { name: "role", description: "Rollen", type: 8, required: true },
  ]},
  { name: "roles", description: "Vis alle roller på serveren" },
  { name: "members", description: "Vis medlemsstatistik" },
  { name: "emojis", description: "Vis serverens emojis" },
  { name: "banner", description: "Vis en brugers banner", options: [
    { name: "user", description: "Bruger (valgfri)", type: 6 },
  ]},
  { name: "snipe", description: "Vis den senest slettede besked i kanalen" },
  { name: "editsnipe", description: "Vis den senest redigerede besked i kanalen" },
  { name: "embed", description: "Send en embed-besked", options: [
    { name: "description", description: "Indhold", type: 3, required: true },
    { name: "title", description: "Titel", type: 3 },
    { name: "color", description: "Hex-farve, f.eks. #5865F2", type: 3 },
    { name: "channel", description: "Kanal (standard: denne)", type: 7 },
  ]},
  { name: "announce", description: "Send en meddelelse", options: [
    { name: "message", description: "Beskeden", type: 3, required: true },
    { name: "channel", description: "Kanal (standard: denne)", type: 7 },
    { name: "ping", description: "Ping", type: 3, choices: [
      { name: "@everyone", value: "everyone" },
      { name: "@here", value: "here" },
      { name: "Ingen", value: "none" },
    ]},
  ]},
  { name: "quote", description: "Citér en besked fra denne kanal", options: [
    { name: "message_id", description: "Besked-ID", type: 3, required: true },
  ]},
  { name: "vote", description: "Start en hurtig ja/nej afstemning", options: [
    { name: "question", description: "Spørgsmålet", type: 3, required: true },
  ]},

  // FUN (nye)
  { name: "ascii", description: "Lav ASCII-tekst", options: [
    { name: "text", description: "Tekst (maks 12 tegn)", type: 3, required: true },
  ]},
  { name: "mock", description: "SpOtTeNdE tEkSt", options: [
    { name: "text", description: "Tekst", type: 3, required: true },
  ]},
  { name: "reverse", description: "Vend tekst om", options: [
    { name: "text", description: "Tekst", type: 3, required: true },
  ]},
  { name: "fact", description: "Få en tilfældig sjov fakta" },

  // ECONOMY (nye)
  { name: "shop", description: "Se butikken" },
  { name: "buy", description: "Køb en vare i butikken", options: [
    { name: "item", description: "Varens navn eller nummer", type: 3, required: true },
  ]},
  { name: "inventory", description: "Se dine købte varer" },
  { name: "crime", description: "Begå kriminalitet for penge (30 min cooldown)" },
  { name: "weekly", description: "Hent din ugentlige belønning" },
  { name: "slots", description: "Spil på enarmet tyveknægt", options: [
    { name: "bet", description: "Indsats", type: 4, required: true },
  ]},
  { name: "gamble", description: "Gamble dine penge", options: [
    { name: "bet", description: "Indsats", type: 4, required: true },
  ]},
  { name: "roulette", description: "Spil roulette", options: [
    { name: "bet", description: "Indsats", type: 4, required: true },
    { name: "choice", description: "Dit valg", type: 3, required: true, choices: [
      { name: "Rød", value: "red" },
      { name: "Sort", value: "black" },
      { name: "Grøn (0)", value: "green" },
      { name: "Lige", value: "even" },
      { name: "Ulige", value: "odd" },
    ]},
  ]},

  // LEVELING ADMIN (nye)
  { name: "addxp", description: "Tilføj XP til en bruger", options: [
    { name: "user", description: "Bruger", type: 6, required: true },
    { name: "amount", description: "Antal XP", type: 4, required: true },
  ]},
  { name: "removexp", description: "Fjern XP fra en bruger", options: [
    { name: "user", description: "Bruger", type: 6, required: true },
    { name: "amount", description: "Antal XP", type: 4, required: true },
  ]},
  { name: "setxp", description: "Sæt en brugers XP", options: [
    { name: "user", description: "Bruger", type: 6, required: true },
    { name: "amount", description: "XP", type: 4, required: true },
  ]},
  { name: "setlevel", description: "Sæt en brugers level", options: [
    { name: "user", description: "Bruger", type: 6, required: true },
    { name: "level", description: "Level", type: 4, required: true },
  ]},
  { name: "resetxp", description: "Nulstil en brugers XP", options: [
    { name: "user", description: "Bruger", type: 6, required: true },
  ]},
  { name: "resetleaderboard", description: "Nulstil hele XP-leaderboardet (admin)" },

  // TICKET / GIVEAWAY ALIASER
  { name: "close", description: "Luk denne ticket", options: [
    { name: "delete", description: "Slet tråden bagefter", type: 5 },
  ]},
  { name: "claim", description: "Overtag denne ticket" },
  { name: "unclaim", description: "Frigiv denne ticket" },
  { name: "add", description: "Tilføj en bruger til denne ticket", options: [
    { name: "user", description: "Bruger", type: 6, required: true },
  ]},
  { name: "rename", description: "Omdøb denne tråd", options: [
    { name: "name", description: "Nyt navn", type: 3, required: true },
  ]},
  { name: "gstart", description: "Start en giveaway (alias)", options: [
    { name: "prize", description: "Præmie", type: 3, required: true },
    { name: "duration", description: "Varighed, f.eks. 1h", type: 3, required: true },
    { name: "winners", description: "Antal vindere", type: 4 },
    { name: "description", description: "Beskrivelse", type: 3 },
  ]},
  { name: "gend", description: "Afslut en giveaway (alias)", options: [
    { name: "message_id", description: "Besked-ID", type: 3, required: true },
  ]},
  { name: "greroll", description: "Vælg nye vindere (alias)", options: [
    { name: "message_id", description: "Besked-ID", type: 3, required: true },
  ]},
  { name: "glist", description: "Vis aktive giveaways" },

  // ADMIN / CONFIG
  { name: "setup", description: "Vis serverens opsætning og status" },
  { name: "config", description: "Vis eller ændr serverindstillinger", options: [
    { name: "setting", description: "Indstilling", type: 3, choices: [
      { name: "prefix", value: "prefix" },
      { name: "staff_role", value: "staff_role" },
      { name: "whitelist_role", value: "whitelist_role" },
      { name: "automod", value: "automod" },
    ]},
    { name: "value", description: "Ny værdi", type: 3 },
  ]},
  { name: "prefix", description: "Vis eller sæt serverens kommando-prefix", options: [
    { name: "prefix", description: "Nyt prefix (maks 5 tegn)", type: 3 },
  ]},
  { name: "setlog", description: "Sæt log-kanalen", options: [
    { name: "channel", description: "Log-kanal", type: 7, channel_types: [0] },
  ]},
  { name: "autorole", description: "Administrér roller som nye medlemmer får automatisk", options: [
    { name: "action", description: "Handling", type: 3, choices: [
      { name: "list", value: "list" }, { name: "add", value: "add" },
      { name: "remove", value: "remove" }, { name: "clear", value: "clear" },
    ]},
    { name: "role", description: "Rollen", type: 8 },
  ]},
  { name: "setwelcome", description: "Sæt velkomstkanal og -besked", options: [
    { name: "channel", description: "Velkomstkanal", type: 7, channel_types: [0] },
    { name: "message", description: "Besked ({user}, {server}, {membercount})", type: 3 },
  ]},
  { name: "setleave", description: "Sæt farvel-kanal og -besked", options: [
    { name: "channel", description: "Farvel-kanal", type: 7, channel_types: [0] },
    { name: "message", description: "Besked ({user}, {server}, {membercount})", type: 3 },
  ]},
  { name: "automod", description: "Styr automod", options: [
    { name: "action", description: "Handling", type: 3, choices: [
      { name: "status", value: "status" }, { name: "on", value: "on" }, { name: "off", value: "off" },
    ]},
    { name: "rule", description: "Specifik regel (valgfri)", type: 3 },
  ]},
  { name: "backup", description: "Opret eller vis backups af serveren", options: [
    { name: "action", description: "Handling", type: 3, choices: [
      { name: "create", value: "create" }, { name: "list", value: "list" },
    ]},
    { name: "description", description: "Beskrivelse af backuppen", type: 3 },
  ]},
  { name: "restore", description: "Gendan roller/kanaler fra en backup (kun serverejer)", options: [
    { name: "backup_id", description: "Backup-ID", type: 3 },
    { name: "mode", description: "Hvad skal gendannes", type: 3, choices: [
      { name: "roles", value: "roles" }, { name: "channels", value: "channels" }, { name: "all", value: "all" },
    ]},
  ]},

  // REACTION ROLES
  { name: "reactionrole", description: "Opret et reaction role-panel", options: [
    { name: "channel", description: "Kanal til panelet", type: 7, channel_types: [0] },
    { name: "title", description: "Titel", type: 3 },
    { name: "description", description: "Beskrivelse", type: 3 },
  ]},
  { name: "rr-add", description: "Tilføj en rolle til et reaction role-panel", options: [
    { name: "message_id", description: "Panelets besked-ID", type: 3, required: true },
    { name: "role", description: "Rollen", type: 8, required: true },
    { name: "emoji", description: "Emoji", type: 3 },
    { name: "description", description: "Kort beskrivelse", type: 3 },
  ]},
  { name: "rr-remove", description: "Fjern en rolle fra et reaction role-panel", options: [
    { name: "message_id", description: "Panelets besked-ID", type: 3, required: true },
    { name: "role", description: "Rollen", type: 8, required: true },
  ]},
  { name: "rr-list", description: "Vis alle reaction role-paneler" },
  { name: "rr-clear", description: "Ryd roller fra et panel (eller alle paneler)", options: [
    { name: "message_id", description: "Panelets besked-ID", type: 3 },
  ]},

  // LEVELING ADMIN
  { name: "levelroles", description: "Vis level-roller" },
  { name: "setlevelrole", description: "Sæt en rolle der gives ved et bestemt level", options: [
    { name: "level", description: "Level", type: 4, required: true },
    { name: "role", description: "Rollen", type: 8 },
    { name: "remove", description: "Fjern level-rollen i stedet", type: 5 },
  ]},
  { name: "xpmultiplier", description: "Styr XP-multipliers for roller/kanaler", options: [
    { name: "action", description: "Handling", type: 3, choices: [
      { name: "list", value: "list" }, { name: "set", value: "set" }, { name: "remove", value: "remove" },
    ]},
    { name: "role", description: "Rolle", type: 8 },
    { name: "channel", description: "Kanal", type: 7 },
    { name: "multiplier", description: "Multiplier (0.1-10)", type: 10 },
  ]},

  // MUSIC EXTRAS
  { name: "seek", description: "Spol til et tidspunkt i sangen", options: [
    { name: "position", description: "F.eks. 90, 1:30 eller 1:02:30", type: 3, required: true },
  ]},
  { name: "lyrics", description: "Hent sangtekst", options: [
    { name: "song", description: "Kunstner - Titel (valgfri)", type: 3 },
  ]},
  { name: "autoplay", description: "Slå autoplay til/fra" },
  { name: "filter", description: "Anvend et lydfilter", options: [
    { name: "filter", description: "Filter", type: 3, required: true, choices: [
      { name: "clear", value: "clear" }, { name: "bassboost", value: "bassboost" },
      { name: "nightcore", value: "nightcore" }, { name: "vaporwave", value: "vaporwave" },
      { name: "8d", value: "8d" }, { name: "karaoke", value: "karaoke" },
      { name: "tremolo", value: "tremolo" }, { name: "vibrato", value: "vibrato" },
    ]},
  ]},

  // UTILITY
  { name: "support", description: "Opret en supportticket" },
  { name: "translate", description: "Oversæt tekst", options: [
    { name: "text", description: "Tekst der skal oversættes", type: 3, required: true },
    { name: "to", description: "Målsprog (da, en, de, ...)", type: 3 },
  ]},
  { name: "weather", description: "Vis vejret for en by", options: [
    { name: "location", description: "By eller postnummer", type: 3, required: true },
  ]},

  // TICKETS / GIVEAWAY
  { name: "transcript", description: "Hent transkript for en ticket", options: [
    { name: "ticket_id", description: "Ticket-ID eller kanal-ID", type: 3 },
  ]},
  { name: "gpause", description: "Sæt en giveaway på pause / genoptag den", options: [
    { name: "message_id", description: "Giveawayens besked-ID", type: 3, required: true },
  ]},

  // ECONOMY / GAMES
  { name: "sell", description: "Sælg en vare tilbage til shoppen (50% refusion)", options: [
    { name: "item", description: "Varens navn", type: 3, required: true },
  ]},
  { name: "blackjack", description: "Spil blackjack mod dealeren", options: [
    { name: "bet", description: "Indsats (0 = uden penge)", type: 4 },
  ]},
  { name: "trivia", description: "Svar på et trivia-spørgsmål" },
  { name: "ttt", description: "Spil kryds og bolle mod en anden", options: [
    { name: "opponent", description: "Modstander", type: 6, required: true },
  ]},
  { name: "connect4", description: "Spil fire på stribe mod en anden", options: [
    { name: "opponent", description: "Modstander", type: 6, required: true },
  ]},
  { name: "hangman", description: "Spil galgeleg" },
  { name: "wordle", description: "Spil wordle på dansk" },
];


__serve(async (req) => {
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
      __env("SUPABASE_URL")!,
      __env("SUPABASE_SERVICE_ROLE_KEY")!
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

    const defaultBotToken = __env("DISCORD_BOT_TOKEN");
    const defaultAppId = __env("DISCORD_CLIENT_ID");

    // Mode: clear-global always targets the default application, so the
    // default credentials are required only for this operation.
    if (mode === "clear-global") {
      if (!defaultBotToken || !defaultAppId) {
        return new Response(
          JSON.stringify({
            error: "Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID secret for clear-global",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    if (!botToken || !appId) {
      const hasEncryptionKey = Boolean(__env("BOT_SECRET_KEY"));
      return new Response(
        JSON.stringify({
          error: hasEncryptionKey
            ? "No usable Discord bot credentials found for this guild. Configure an active custom bot or set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID."
            : "No usable Discord bot credentials found. Custom bots require BOT_SECRET_KEY on the web runtime; otherwise set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // /fivem is registered by the dedicated FiveM command route.
    // Bulk-overwrite normally deletes commands that are not included, so preserve
    // an existing /fivem definition when redeploying the main catalog.
    let commandsToDeploy: any[] = groupFlatCommandDefinitions(COMMANDS);
    try {
      const existingRes = await fetch(
        `https://discord.com/api/v10/applications/${appId}/guilds/${discordGuildId}/commands`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );

      if (existingRes.ok) {
        const existingCommands = await existingRes.json();
        const existingFiveM = existingCommands.find((command: any) => command.name === "fivem");
        if (existingFiveM) {
          commandsToDeploy.push({
            name: existingFiveM.name,
            description: existingFiveM.description,
            type: existingFiveM.type,
            options: existingFiveM.options || [],
            default_member_permissions: existingFiveM.default_member_permissions ?? null,
            nsfw: Boolean(existingFiveM.nsfw),
          });
        }
      }
    } catch (preserveError) {
      console.warn("Could not inspect existing guild commands before deploy:", preserveError);
    }

    const guildRes = await fetch(
      `https://discord.com/api/v10/applications/${appId}/guilds/${discordGuildId}/commands`,
      {
        method: "PUT",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(commandsToDeploy),
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
        logicalCommands: canonicalLogicalCommands.length,
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


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/deploy-guild-commands')({
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
