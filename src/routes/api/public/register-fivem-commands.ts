// @ts-nocheck
// Migrated from Supabase Edge Function `register-fivem-commands` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// FiveM subcommands organized by category
const FIVEM_SUBCOMMANDS = {
  // Moderation subcommands
  moderation: [
    {
      name: "kick",
      description: "Kick a player from the server",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "reason", description: "Kick reason", type: 3, required: false },
      ],
      permission: "mod",
    },
    {
      name: "kickall",
      description: "Kick all players from the server",
      options: [{ name: "reason", description: "Kick reason", type: 3, required: true }],
      permission: "admin",
    },
    {
      name: "ban",
      description: "Ban a player from the server",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "duration", description: "Ban duration (e.g., 1h, 1d, 7d, perm)", type: 3, required: true },
        { name: "reason", description: "Ban reason", type: 3, required: true },
      ],
      permission: "admin",
    },
    {
      name: "warn",
      description: "Warn a player",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "reason", description: "Warning reason", type: 3, required: true },
      ],
      permission: "mod",
    },
    {
      name: "jail",
      description: "Jail a player",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "time", description: "Jail time in minutes", type: 4, required: true },
        { name: "reason", description: "Jail reason", type: 3, required: false },
      ],
      permission: "mod",
    },
    {
      name: "unjail",
      description: "Release a player from jail",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "mod",
    },
    {
      name: "freeze",
      description: "Freeze a player in place",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "mod",
    },
    {
      name: "unfreeze",
      description: "Unfreeze a player",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "mod",
    },
    {
      name: "spectate",
      description: "Spectate a player",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "mod",
    },
  ],

  // Player management subcommands
  player: [
    {
      name: "kill",
      description: "Kill a player",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "admin",
    },
    {
      name: "revive",
      description: "Revive a player",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "admin",
    },
    {
      name: "revive-all",
      description: "Revive all players",
      options: [],
      permission: "god",
    },
    {
      name: "heal",
      description: "Heal a player to full health",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "admin",
    },
    {
      name: "armor",
      description: "Give a player full armor",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "admin",
    },
    {
      name: "sethealth",
      description: "Set a player's health",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "amount", description: "Health amount (0-200)", type: 4, required: true },
      ],
      permission: "admin",
    },
    {
      name: "setarmor",
      description: "Set a player's armor",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "amount", description: "Armor amount (0-100)", type: 4, required: true },
      ],
      permission: "admin",
    },
    {
      name: "sethunger",
      description: "Set a player's hunger",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "amount", description: "Hunger amount (0-100)", type: 4, required: true },
      ],
      permission: "admin",
    },
    {
      name: "setthirst",
      description: "Set a player's thirst",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "amount", description: "Thirst amount (0-100)", type: 4, required: true },
      ],
      permission: "admin",
    },
    {
      name: "setstress",
      description: "Set a player's stress level",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "amount", description: "Stress amount (0-100)", type: 4, required: true },
      ],
      permission: "admin",
    },
    {
      name: "setmodel",
      description: "Change a player's ped model",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "model", description: "Model name", type: 3, required: true },
      ],
      permission: "admin",
    },
    {
      name: "logout",
      description: "Force logout a player",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "admin",
    },
    {
      name: "identifiers",
      description: "Get player identifiers",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "admin",
    },
    {
      name: "permissions",
      description: "View player permissions",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "admin",
    },
    {
      name: "godmode",
      description: "Toggle godmode for a player",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "god",
    },
    {
      name: "invisible",
      description: "Toggle invisibility for a player",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "admin",
    },
    {
      name: "noclip",
      description: "Toggle noclip for a player",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "admin",
    },
  ],

  // Teleport subcommands
  teleport: [
    {
      name: "player",
      description: "Teleport a player to coordinates or preset",
      options: [
        { name: "type", description: "Teleport type", type: 3, required: true, choices: [
          { name: "coords", value: "coords" },
          { name: "preset", value: "preset" },
        ]},
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "x", description: "X coordinate (for coords)", type: 10, required: false },
        { name: "y", description: "Y coordinate (for coords)", type: 10, required: false },
        { name: "z", description: "Z coordinate (for coords)", type: 10, required: false },
        { name: "location", description: "Preset location name (for preset)", type: 3, required: false },
        { name: "keepvehicle", description: "Keep player in vehicle", type: 5, required: false },
      ],
      permission: "mod",
    },
    {
      name: "all",
      description: "Teleport all players",
      options: [
        { name: "type", description: "Teleport type", type: 3, required: true, choices: [
          { name: "coords", value: "coords" },
          { name: "preset", value: "preset" },
        ]},
        { name: "x", description: "X coordinate", type: 10, required: false },
        { name: "y", description: "Y coordinate", type: 10, required: false },
        { name: "z", description: "Z coordinate", type: 10, required: false },
        { name: "location", description: "Preset location", type: 3, required: false },
      ],
      permission: "god",
    },
    {
      name: "bring",
      description: "Bring a player to you",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "mod",
    },
    {
      name: "goto",
      description: "Go to a player",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "mod",
    },
  ],

  // Vehicle subcommands
  vehicle: [
    {
      name: "spawn",
      description: "Spawn a vehicle for a player",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "spawncode", description: "Vehicle spawn code", type: 3, required: true },
        { name: "plate", description: "License plate", type: 3, required: false },
      ],
      permission: "god",
    },
    {
      name: "delete",
      description: "Delete a player's vehicle",
      options: [{ name: "id", description: "Player server ID", type: 4, required: false }],
      permission: "admin",
    },
    {
      name: "repair",
      description: "Repair a player's vehicle",
      options: [{ name: "id", description: "Player server ID", type: 4, required: false }],
      permission: "mod",
    },
  ],

  // Weapon subcommands
  weapon: [
    {
      name: "give",
      description: "Give a weapon to a player",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "weapon", description: "Weapon code (e.g., WEAPON_PISTOL)", type: 3, required: true },
        { name: "ammo", description: "Ammo amount", type: 4, required: false },
      ],
      permission: "god",
    },
    {
      name: "remove",
      description: "Remove a weapon from a player",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "weapon", description: "Weapon code", type: 3, required: true },
      ],
      permission: "admin",
    },
    {
      name: "clear",
      description: "Remove all weapons from a player",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "admin",
    },
  ],

  // Economy subcommands
  economy: [
    {
      name: "money",
      description: "Manage player money",
      options: [
        { name: "action", description: "Action", type: 3, required: true, choices: [
          { name: "add", value: "add" },
          { name: "remove", value: "remove" },
          { name: "set", value: "set" },
          { name: "inspect", value: "inspect" },
        ]},
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "type", description: "Money type (cash/bank/crypto)", type: 3, required: false },
        { name: "amount", description: "Amount", type: 4, required: false },
      ],
      permission: "admin",
    },
    {
      name: "inventory",
      description: "Manage player inventory",
      options: [
        { name: "action", description: "Action", type: 3, required: true, choices: [
          { name: "give", value: "give" },
          { name: "inspect", value: "inspect" },
          { name: "take", value: "take" },
          { name: "clear", value: "clear" },
        ]},
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "item", description: "Item name", type: 3, required: false },
        { name: "count", description: "Item count", type: 4, required: false },
      ],
      permission: "admin",
    },
  ],

  // Job/Gang subcommands
  jobs: [
    {
      name: "job",
      description: "Manage player jobs",
      options: [
        { name: "action", description: "Action", type: 3, required: true, choices: [
          { name: "fire", value: "fire" },
          { name: "inspect", value: "inspect" },
          { name: "set", value: "set" },
        ]},
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "job", description: "Job name (for set)", type: 3, required: false },
        { name: "grade", description: "Job grade (for set)", type: 4, required: false },
      ],
      permission: "admin",
    },
    {
      name: "gang",
      description: "Manage player gangs",
      options: [
        { name: "action", description: "Action", type: 3, required: true, choices: [
          { name: "kick", value: "kick" },
          { name: "inspect", value: "inspect" },
          { name: "set", value: "set" },
        ]},
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "gang", description: "Gang name (for set)", type: 3, required: false },
        { name: "grade", description: "Gang grade (for set)", type: 4, required: false },
      ],
      permission: "admin",
    },
    {
      name: "clothing-menu",
      description: "Open clothing menu for a player",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "admin",
    },
  ],

  // Server management subcommands
  server: [
    {
      name: "info",
      description: "Get server information",
      options: [],
      permission: "user",
    },
    {
      name: "players",
      description: "List all online players",
      options: [],
      permission: "mod",
    },
    {
      name: "count",
      description: "Get the current online player count",
      options: [],
      permission: "user",
    },
    {
      name: "announcement",
      description: "Send an announcement to all players",
      options: [{ name: "message", description: "Announcement message", type: 3, required: true }],
      permission: "mod",
    },
    {
      name: "message",
      description: "Send a private message to a player",
      options: [
        { name: "id", description: "Player server ID", type: 4, required: true },
        { name: "message", description: "Message content", type: 3, required: true },
      ],
      permission: "mod",
    },
    {
      name: "time",
      description: "Set server time",
      options: [{ name: "hour", description: "Hour (0-23)", type: 4, required: true }],
      permission: "admin",
    },
    {
      name: "weather",
      description: "Set server weather",
      options: [
        { name: "action", description: "Action", type: 3, required: true, choices: [
          { name: "set", value: "set" },
          { name: "blackout", value: "blackout" },
        ]},
        { name: "weather", description: "Weather type", type: 3, required: false, choices: [
          { name: "clear", value: "CLEAR" },
          { name: "extrasunny", value: "EXTRASUNNY" },
          { name: "clouds", value: "CLOUDS" },
          { name: "overcast", value: "OVERCAST" },
          { name: "rain", value: "RAIN" },
          { name: "thunder", value: "THUNDER" },
          { name: "snow", value: "SNOW" },
          { name: "blizzard", value: "BLIZZARD" },
          { name: "fog", value: "FOGGY" },
          { name: "xmas", value: "XMAS" },
        ]},
      ],
      permission: "admin",
    },
    {
      name: "resource",
      description: "Manage server resources",
      options: [
        { name: "action", description: "Action to perform", type: 3, required: true, choices: [
          { name: "ensure", value: "ensure" },
          { name: "start", value: "start" },
          { name: "stop", value: "stop" },
          { name: "restart", value: "restart" },
          { name: "refresh", value: "refresh" },
          { name: "list", value: "list" },
          { name: "inspect", value: "inspect" },
        ]},
        { name: "name", description: "Resource name", type: 3, required: false },
      ],
      permission: "god",
    },
    {
      name: "screenshot",
      description: "Take a screenshot of a player's screen",
      options: [{ name: "id", description: "Player server ID", type: 4, required: true }],
      permission: "god",
    },
    {
      name: "embed",
      description: "Send an embed message",
      options: [
        { name: "type", description: "Embed type", type: 3, required: true, choices: [
          { name: "simple", value: "simple" },
          { name: "complex", value: "complex" }
        ]},
        { name: "channel", description: "Target channel", type: 7, required: true },
        { name: "message", description: "Message content", type: 3, required: true },
        { name: "title", description: "Embed title", type: 3, required: false },
        { name: "color", description: "Embed color (hex)", type: 3, required: false },
      ],
      permission: "god",
    },
  ],

  // Whitelist subcommands
  whitelist: [
    {
      name: "toggle",
      description: "Toggle whitelist on/off",
      options: [],
      permission: "admin",
    },
    {
      name: "add",
      description: "Add a user to whitelist",
      options: [{ name: "discord_id", description: "Discord user ID", type: 3, required: true }],
      permission: "admin",
    },
    {
      name: "remove",
      description: "Remove a user from whitelist",
      options: [{ name: "discord_id", description: "Discord user ID", type: 3, required: true }],
      permission: "admin",
    },
    {
      name: "check",
      description: "Check if a user is whitelisted",
      options: [{ name: "discord_id", description: "Discord user ID", type: 3, required: true }],
      permission: "mod",
    },
    {
      name: "addrole",
      description: "Add a role to auto-whitelist",
      options: [{ name: "role_id", description: "Discord role ID", type: 3, required: true }],
      permission: "admin",
    },
    {
      name: "removerole",
      description: "Remove a role from auto-whitelist",
      options: [{ name: "role_id", description: "Discord role ID", type: 3, required: true }],
      permission: "admin",
    },
  ],
};

// Build the main /fivem command with subcommand groups
function buildFivemCommand() {
  const subcommandGroups = Object.entries(FIVEM_SUBCOMMANDS).map(([groupName, subcommands]) => ({
    type: 2, // Subcommand group
    name: groupName,
    description: `FiveM ${groupName} commands`,
    options: subcommands.map(cmd => ({
      type: 1, // Subcommand
      name: cmd.name,
      description: cmd.description,
      options: cmd.options,
    })),
  }));

  return {
    name: "fivem",
    description: "FiveM server administration commands",
    options: subcommandGroups,
    default_member_permissions: "2", // Kick Members (base permission, individual commands check further)
  };
}

// Helper to get the legacy command name from new structure
function getCommandMapping(): Record<string, { group: string; subcommand: string }> {
  const mapping: Record<string, { group: string; subcommand: string }> = {};
  
  // Create reverse mapping for command queue compatibility
  Object.entries(FIVEM_SUBCOMMANDS).forEach(([group, commands]) => {
    commands.forEach(cmd => {
      // Map old command names to new structure
      const legacyName = cmd.name;
      mapping[legacyName] = { group, subcommand: cmd.name };
    });
  });
  
  return mapping;
}

__serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = __env("SUPABASE_URL")!;
    const supabaseServiceKey = __env("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { guild_id, action } = await req.json();

    if (!guild_id) {
      return new Response(JSON.stringify({ error: "guild_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Discord guild_id from internal guild_id
    const { data: guild, error: guildError } = await supabase
      .from("guilds")
      .select("guild_id")
      .eq("id", guild_id)
      .single();

    if (guildError || !guild) {
      return new Response(JSON.stringify({ error: "Guild not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const discordGuildId = guild.guild_id;

    if (action === "register" || action === "unregister") {
      // Slash commands are deployed automatically by CustomBotManager using the
      // correct bot application for this guild. Keeping registration here would
      // reintroduce duplicate/wrong-app commands in custom-bot guilds.
      return new Response(
        JSON.stringify({
          success: true,
          managed: true,
          message: "FiveM slash commands synkroniseres automatisk af Bot Manager. Ingen manuel registrering er nødvendig.",
          discordGuildId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "list") {
      // Return structured list of all commands
      const commandList: any[] = [];
      
      Object.entries(FIVEM_SUBCOMMANDS).forEach(([group, commands]) => {
        commands.forEach(cmd => {
          commandList.push({
            command: `/fivem ${group} ${cmd.name}`,
            description: cmd.description,
            permission: cmd.permission,
            group,
          });
        });
      });

      return new Response(
        JSON.stringify({ 
          commands: commandList,
          groups: Object.keys(FIVEM_SUBCOMMANDS),
          total: commandList.length,
          mapping: getCommandMapping()
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'register', 'unregister', or 'list'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/register-fivem-commands')({
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
