Config = {}

Config.Version = '1.0.0'
Config.ApiBase = GetConvar('gms_api_base', 'https://bot.nethost-solutions.dk')
Config.GuildId = GetConvar('gms_guild_id', '')
Config.ApiKey = GetConvar('gms_api_key', '')
Config.ServerId = GetConvar('gms_server_id', 'main')
Config.Framework = GetConvar('gms_framework', 'auto'):lower()

Config.CommandPollMs = tonumber(GetConvar('gms_command_poll_ms', '1500')) or 1500
Config.PlayerSyncMs = tonumber(GetConvar('gms_player_sync_ms', '15000')) or 15000
Config.HeartbeatMs = tonumber(GetConvar('gms_heartbeat_ms', '30000')) or 30000
Config.SettingsRefreshMs = tonumber(GetConvar('gms_settings_refresh_ms', '60000')) or 60000

-- false = deny joins when the dashboard cannot be reached while whitelist is enabled.
Config.FailOpen = GetConvar('gms_fail_open', 'false') == 'true'

-- Optional adapters for server-specific resources.
-- Leave blank to use built-in/native fallbacks where possible.
Config.Events = {
    Revive = GetConvar('gms_event_revive', ''),
    Jail = GetConvar('gms_event_jail', ''),
    Unjail = GetConvar('gms_event_unjail', ''),
    Clothing = GetConvar('gms_event_clothing', ''),
}

Config.Presets = {
    legion = vector3(215.76, -810.12, 30.73),
    mrpd = vector3(425.13, -979.56, 30.71),
    pillbox = vector3(307.17, -595.31, 43.28),
    airport = vector3(-1034.60, -2733.60, 20.17),
    sandy = vector3(1853.08, 3689.51, 34.27),
    paleto = vector3(-105.57, 6469.13, 31.63),
}
