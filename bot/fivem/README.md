# FiveM ↔ Discord Integration (Full zdiscord Implementation)

This resource provides a complete zdiscord-style integration between your FiveM server and the Lovable dashboard. All 52 commands from zdiscord are implemented with full QBCore support.

## Features

✅ **Whitelist System** - Approve players via Discord before they can join  
✅ **Ban System** - Ban players by Discord/Steam/License with durations  
✅ **Full zdiscord Commands (52)** - All standalone + QBCore commands  
✅ **ACE Permission Sync** - Auto-grant ACE permissions based on Discord roles  
✅ **Live Player Tracking** - See online players in dashboard  
✅ **Playtime Tracking** - Track player playtime  
✅ **Action Logging** - All mod actions logged to dashboard  
✅ **zdiscord-compatible Exports** - Use in other resources  
✅ **QBCore Integration** - Full job, gang, money, inventory management  
✅ **Teleport Presets** - Pre-configured locations for quick teleports  
✅ **Resource Management** - Start/stop/ensure resources via commands  

## Installation

1. **Copy the folder** to your FiveM `resources` folder
2. **Rename the folder** to `fivem-discord-integration`
3. **Configure** `server.lua` with your settings
4. **Add to server.cfg**: `ensure fivem-discord-integration`

## Configuration

Open `server.lua` and update these values:

```lua
local API_URL = "https://sleiplyixaxuvydzudxn.supabase.co/functions/v1/fivem-handler"
local BOT_SECRET_KEY = "YOUR_BOT_SECRET_KEY_HERE"  -- From dashboard secrets
local GUILD_ID = "YOUR_DISCORD_GUILD_ID_HERE"      -- Your Discord server ID
```

### Config Options

```lua
local Config = {
    WhitelistEnabled = true,                    -- Require whitelist to join
    WhitelistRoles = {},                        -- Discord role IDs that auto-whitelist
    KickMessage = "You are not whitelisted...", -- Message for non-whitelisted
    BanMessage = "You are banned. Reason: %s",  -- Ban message (%s = reason)
    UpdateInterval = 30000,                     -- Player list update (ms)
    PlaytimeInterval = 300000,                  -- Playtime sync interval (ms)
    SyncAcePermissions = true,                  -- Auto-apply ACE from Discord roles
    Framework = "qbcore",                       -- "qbcore", "esx", or "standalone"
}
```

### Teleport Presets

Built-in locations for quick teleports:

| Name | Description |
|------|-------------|
| `pillbox` | Pillbox Hospital |
| `legion` | Legion Square |
| `paleto` | Paleto Bay |
| `sandy` | Sandy Shores |
| `prison` | Bolingbroke Prison |
| `airport` | Los Santos Airport |
| `casino` | Diamond Casino |
| `police_mrpd` | Mission Row PD |
| `police_davis` | Davis PD |
| `police_sandy` | Sandy Shores PD |
| `police_paleto` | Paleto Bay PD |
| `city_hall` | City Hall |

---

## Standalone Commands (25)

| Command | Permission | Description |
|---------|------------|-------------|
| `/announcement [message]` | mod+ | Send server-wide announcement |
| `/embed complex [channel] [json]` | god | Send complex embed to Discord |
| `/embed simple [channel] [message] (title) (image) (thumbnail) (footer) (color)` | god | Send simple embed |
| `/identifiers [id]` | admin+ | View player identifiers |
| `/kick [id] (message)` | mod+ | Kick a player |
| `/kickall [message]` | admin+ | Kick all players |
| `/kill [id]` | admin+ | Kill a player |
| `/message [id] [message]` | mod+ | Send private message to player |
| `/onlinecount` | all | Show online player count |
| `/players` | mod+ | List online players with details |
| `/resource ensure [resource]` | god | Restart a resource |
| `/resource inspect [resource]` | god | View resource info |
| `/resource list` | god | List all resources |
| `/resource refresh` | god | Refresh resource list |
| `/resource start [resource]` | god | Start a resource |
| `/resource stop [resource]` | god | Stop a resource |
| `/server` | all | Show server info |
| `/screenshot [id]` | god | Take screenshot of player |
| `/teleport coords [id] [x] [y] [z] (keepVehicle)` | mod+ | Teleport to coordinates |
| `/teleport preset [id] [location] (keepVehicle)` | mod+ | Teleport to preset location |
| `/teleport-all coords [x] [y] [z]` | god | Teleport all players to coords |
| `/teleport-all preset [location]` | god | Teleport all to preset |
| `/whitelist toggle [true/false]` | god | Enable/disable whitelist |
| `/whitelist addrole [role]` | god | Add auto-whitelist role |
| `/whitelist removerole [role]` | god | Remove auto-whitelist role |

---

## QBCore Commands (27)

| Command | Permission | Description |
|---------|------------|-------------|
| `/ban [id] [time] [reason]` | admin+ | Ban a player (time: 1h, 1d, 7d, permanent) |
| `/clothing-menu [id]` | admin+ | Open clothing menu for player |
| `/gang kick [id]` | admin+ | Remove player from gang |
| `/gang inspect [id]` | admin+ | View player gang info |
| `/gang set [id] [gang] [grade]` | admin+ | Set player gang |
| `/inventory give [id] [item] [count]` | admin+ | Give item to player |
| `/inventory inspect [id]` | admin+ | View player inventory |
| `/inventory take [id] [item] [count]` | admin+ | Take item from player |
| `/jail free [id]` | mod+ | Release player from jail |
| `/jail sentence [id] [time]` | mod+ | Jail a player |
| `/job fire [id]` | admin+ | Fire player from job |
| `/job inspect [id]` | admin+ | View player job info |
| `/job set [id] [job] [grade]` | admin+ | Set player job |
| `/logout [id]` | admin+ | Force logout player |
| `/money add [id] [type] [amount]` | admin+ | Add money to player |
| `/money inspect [id]` | admin+ | View player money |
| `/money remove [id] [type] [amount]` | admin+ | Remove money from player |
| `/money set [id] [type] [amount]` | admin+ | Set player money |
| `/permissions add [id] [permission]` | god | Add ACE permission |
| `/permissions remove [id] [permission]` | god | Remove ACE permission |
| `/revive [id]` | admin+ | Revive a player |
| `/revive-all` | god | Revive all players |
| `/time [hour]` | admin+ | Set server time (0-23) |
| `/vehicle give [id] [spawncode] (plate)` | god | Give vehicle to player |
| `/vehicle lookup [plate]` | god | Lookup vehicle by plate |
| `/weather blackout` | admin+ | Toggle blackout mode |
| `/weather set [weather]` | admin+ | Set server weather |

---

## Exports (zdiscord-compatible)

### isRolePresent
Check if player has a Discord role.

```lua
-- Single role
local hasRole = exports['fivem-discord-integration']:isRolePresent(source, "897991948097433681")

-- Multiple roles (any match)
local hasRole = exports['fivem-discord-integration']:isRolePresent(source, {
    "897991948097433681",
    "897991948097433682"
})
```

### getDiscordId
Get player's Discord ID.

```lua
local discordId = exports['fivem-discord-integration']:getDiscordId(source)
```

### getRoles
Get all Discord roles for a player.

```lua
local roles = exports['fivem-discord-integration']:getRoles(source)
for _, roleId in ipairs(roles) do
    print(roleId)
end
```

### getName
Get player's Discord name.

```lua
local name = exports['fivem-discord-integration']:getName(source)
```

### getPermissionLevel
Get player's permission level (user, mod, admin, god).

```lua
local level = exports['fivem-discord-integration']:getPermissionLevel(source)
if level == "admin" or level == "god" then
    -- Allow admin action
end
```

### isWhitelisted
Check if player is whitelisted.

```lua
local whitelisted = exports['fivem-discord-integration']:isWhitelisted(source)
```

### getPlayerPriority
Get player's queue priority (for queue systems).

```lua
local priority = exports['fivem-discord-integration']:getPlayerPriority(source)
-- Higher = joins queue faster
```

### log
Send a log message to the dashboard.

```lua
-- event, message, pingRole, color (optional)
exports['fivem-discord-integration']:log("modlog", "Player banned for RDM", true, "#FF0000")
```

---

## Permission Levels

Configure in dashboard under FiveM > Permissions:

| Level | Commands | Description |
|-------|----------|-------------|
| `user` | `/onlinecount`, `/server` | Normal player (default) |
| `mod` | Above + `/kick`, `/message`, `/teleport`, `/players`, etc. | Moderator |
| `admin` | Above + `/ban`, `/kill`, `/job`, `/money`, etc. | Administrator |
| `god` | All commands | Full access (server owner) |

---

## ACE Permissions

Map Discord roles to ACE permissions in the dashboard. Example ACE permissions:

```
command.kick
command.ban
command.restart
builtin.profiler
```

These are auto-applied when a player with the Discord role joins.

---

## Queue Integration

For queue systems, use the priority export:

```lua
-- In your queue resource
local priority = exports['fivem-discord-integration']:getPlayerPriority(source)
-- Set in dashboard via whitelist entry priority_level (0-100)
```

---

## Discord Role Sync

For role detection to work, you need one of these resources:
- `discord_perms`
- `badger_discord_api`

Or implement your own role fetching in the `getDiscordRoles` function.

---

## Weather Types

Valid weather types for `/weather set`:
- `clear`, `extrasunny`, `clouds`, `overcast`
- `rain`, `thunder`, `snow`, `fog`, `smog`

---

## Troubleshooting

### "Discord not linked" error
Players must link Discord to FiveM:
1. Open FiveM settings
2. Go to Account
3. Link Discord

### Players not getting permissions
1. Check that role is mapped in dashboard
2. Ensure `SyncAcePermissions = true`
3. Verify player has the Discord role

### QBCore commands not working
1. Verify `Config.Framework = "qbcore"`
2. Ensure qb-core resource is started
3. Check server console for errors

### API errors
Check server console for `[FiveM-Discord]` messages.

---

## Support

For issues, check the dashboard action logs or contact support.
