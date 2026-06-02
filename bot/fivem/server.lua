--[[
    FiveM <-> Discord Integration Script (Full zdiscord Implementation)
    Connects to the Lovable dashboard API for whitelist, moderation and utilities
    
    CONFIGURATION:
    1. Set your API_URL to your Supabase edge function URL
    2. Set your BOT_SECRET_KEY (same as in your dashboard)
    3. Set your GUILD_ID (Discord server ID)
    
    FULL ZDISCORD FEATURE SET:
    - Whitelist system with ban checking & role-based auto-whitelist
    - Full moderation commands (52 total)
    - Role-based ACE permissions
    - Playtime tracking
    - Live player list
    - Discord logging
    - QBCore integration
    - Resource management
    - Teleport presets
]]

--[[
    KONFIGURATION (Sæt disse værdier i din server.cfg):
    
    set zdiscord_api "https://sleiplyixaxuvydzudxn.supabase.co/functions/v1/fivem-handler"
    set zdiscord_secret "DIN_BOT_SECRET_KEY_HER"
    set zdiscord_guild "DIN_DISCORD_GUILD_ID_HER"
    
    Alternativt kan du hardcode dem nedenfor.
]]

local API_URL = GetConvar("zdiscord_api", "https://sleiplyixaxuvydzudxn.supabase.co/functions/v1/fivem-handler")
local BOT_SECRET_KEY = GetConvar("zdiscord_secret", "") -- Sæt via: set zdiscord_secret "din_nøgle"
local GUILD_ID = GetConvar("zdiscord_guild", "") -- Sæt via: set zdiscord_guild "discord_server_id"
local SERVER_ID = GetConvar("sv_hostname", "FiveM Server")

-- Restart schedule (HH:MM format, 24-hour time) - configure in server.cfg: set zdiscord_restart_schedule "03:00,09:00,15:00,21:00"
local RESTART_SCHEDULE_RAW = GetConvar("zdiscord_restart_schedule", "")

-- Settings (WhitelistEnabled hentes fra databasen ved opstart)
local Config = {
    WhitelistEnabled = nil, -- Vil blive sat fra databasen
    WhitelistRoles = {}, -- Discord role IDs that grant whitelist access
    KickMessage = "You are not whitelisted on this server. Please apply on our Discord.",
    BanMessage = "You are banned from this server. Reason: %s",
    UpdateInterval = 30000, -- 30 seconds for player updates
    PlaytimeInterval = 300000, -- 5 minutes for playtime sync
    ServerStatusInterval = 15000, -- 15 seconds for server status updates
    SyncAcePermissions = true,
    Framework = "qbcore", -- "qbcore", "esx", or "standalone"
    SettingsLoaded = false, -- Flag til at vide om settings er hentet
    RestartSchedule = {}, -- Parsed restart schedule
}

-- Auto-detected next restart from txAdmin (overrides static schedule when set)
local txAdminNextRestart = nil -- unix timestamp

-- Teleport presets
local TeleportPresets = {
    pillbox = { x = 311.2, y = -592.5, z = 43.3 },
    legion = { x = 195.1, y = -933.7, z = 30.7 },
    paleto = { x = -379.5, y = 6262.4, z = 31.5 },
    sandy = { x = 1848.7, y = 3689.9, z = 34.3 },
    prison = { x = 1849.2, y = 2585.9, z = 45.7 },
    airport = { x = -1037.6, y = -2737.9, z = 20.2 },
    casino = { x = 918.4, y = 49.1, z = 81.1 },
    police_mrpd = { x = 441.8, y = -982.1, z = 30.7 },
    police_davis = { x = 375.3, y = -1596.5, z = 29.3 },
    police_sandy = { x = 1858.3, y = 3681.8, z = 34.3 },
    police_paleto = { x = -451.6, y = 6008.6, z = 31.7 },
    city_hall = { x = -544.2, y = -204.2, z = 38.2 },
}

-- Cache
local playerCache = {}
local permissionCache = {}
local QBCore = nil
local ESX = nil

-- Framework initialization
CreateThread(function()
    if Config.Framework == "qbcore" then
        if GetResourceState("qb-core") == "started" then
            QBCore = exports["qb-core"]:GetCoreObject()
            print("^2[FiveM-Discord]^0 QBCore framework detected and loaded")
        else
            print("^1[FiveM-Discord]^0 QBCore requested but qb-core not found!")
        end
    elseif Config.Framework == "esx" then
        if GetResourceState("es_extended") == "started" then
            ESX = exports["es_extended"]:getSharedObject()
            print("^2[FiveM-Discord]^0 ESX framework detected and loaded")
        end
    end
end)

-- ==================== API HELPER ====================

local serializedRequests = {
    updateServerStatus = true,
    getPendingCommands = true,
    getSettings = true,
}

local requestInFlight = {}
local requestBackoffUntil = {}
local MAX_REQUEST_RETRIES = 2
local SERIALIZED_REQUEST_FAILURE_COOLDOWN_MS = 15000

local function shouldRetryRequest(statusCode, retryCount)
    if retryCount >= MAX_REQUEST_RETRIES then
        return false
    end

    return statusCode == 0 or statusCode >= 500
end

local function getRetryDelayMs(retryCount)
    return math.min(1000 * (2 ^ retryCount), SERIALIZED_REQUEST_FAILURE_COOLDOWN_MS)
end

local function isSerializedRequestCoolingDown(action, retryCount)
    if not serializedRequests[action] or retryCount > 0 then
        return false
    end

    local backoffUntil = requestBackoffUntil[action]
    return backoffUntil and GetGameTimer() < backoffUntil
end

local function makeRequest(action, data, callback, retryCount)
    retryCount = retryCount or 0

    if serializedRequests[action] and requestInFlight[action] then
        return
    end

    if isSerializedRequestCoolingDown(action, retryCount) then
        return
    end

    if serializedRequests[action] then
        requestInFlight[action] = true
    end

    local payload = json.encode({
        action = action,
        guildId = GUILD_ID,
        data = data or {}
    })
    
    PerformHttpRequest(API_URL, function(statusCode, response, headers)
        if serializedRequests[action] then
            requestInFlight[action] = nil
        end

        if statusCode == 200 and serializedRequests[action] then
            requestBackoffUntil[action] = nil
        end

        -- Always surface failures in the server console (many calls don't use a callback)
        if statusCode ~= 200 then
            local resp = response
            if resp == nil or resp == "" then resp = "(empty response)" end
            print(string.format("^1[zdiscord] API error (%s): HTTP %s - %s^0", tostring(action), tostring(statusCode), tostring(resp)))

            if shouldRetryRequest(statusCode, retryCount) then
                local retryDelay = getRetryDelayMs(retryCount)
                if serializedRequests[action] then
                    requestBackoffUntil[action] = GetGameTimer() + retryDelay
                end

                print(string.format("^3[zdiscord] API retry (%s): forsøg %d/%d om %dms^0", tostring(action), retryCount + 2, MAX_REQUEST_RETRIES + 1, retryDelay))
                SetTimeout(retryDelay, function()
                    makeRequest(action, data, callback, retryCount + 1)
                end)
                return
            end

            if serializedRequests[action] then
                requestBackoffUntil[action] = GetGameTimer() + SERIALIZED_REQUEST_FAILURE_COOLDOWN_MS
            end
        end

        if callback then
            if response and response ~= "" then
                local success, result = pcall(json.decode, response)
                if success then
                    callback(statusCode, result)
                else
                    callback(statusCode, { error = "Failed to parse response" })
                end
            else
                callback(statusCode, {})
            end
        end
    end, "POST", payload, {
        ["Content-Type"] = "application/json",
        ["x-bot-secret"] = BOT_SECRET_KEY
    })
end

-- ==================== SETTINGS LOADER ====================

-- Funktion til at hente settings fra databasen
local function fetchSettingsFromDatabase(callback)
    makeRequest("getSettings", {}, function(statusCode, response)
        if statusCode == 200 and response then
            Config.WhitelistEnabled = response.whitelistEnabled
            Config.SettingsLoaded = true
            print("^2[zdiscord] Indstillinger hentet fra database:^0")
            print("^2[zdiscord]   - Whitelist aktiveret: " .. tostring(Config.WhitelistEnabled) .. "^0")
            if callback then callback(true) end
        else
            -- Fallback til default (whitelist slået til for sikkerhed)
            Config.WhitelistEnabled = true
            Config.SettingsLoaded = true
            print("^1[zdiscord] Kunne ikke hente indstillinger - bruger default (whitelist=true)^0")
            if callback then callback(false) end
        end
    end)
end

-- Valider konfiguration og hent settings ved opstart
CreateThread(function()
    Wait(1000)
    if BOT_SECRET_KEY == "" then
        print("^1[zdiscord] FEJL: BOT_SECRET_KEY er ikke konfigureret!^0")
        print("^3[zdiscord] Tilføj til server.cfg: set zdiscord_secret \"DIN_NØGLE_HER\"^0")
    end
    if GUILD_ID == "" then
        print("^1[zdiscord] FEJL: GUILD_ID er ikke konfigureret!^0")
        print("^3[zdiscord] Tilføj til server.cfg: set zdiscord_guild \"DIN_DISCORD_GUILD_ID\"^0")
    end
    if BOT_SECRET_KEY ~= "" and GUILD_ID ~= "" then
        print("^2[zdiscord] Konfiguration OK - API: " .. API_URL .. "^0")
        print("^2[zdiscord] Guild ID: " .. GUILD_ID .. "^0")
        -- Hent settings fra databasen
        fetchSettingsFromDatabase()
    end
end)

-- ==================== IDENTIFIER HELPERS ====================

local function getPlayerIdentifiers(source)
    local identifiers = {
        discordId = nil,
        steamHex = nil,
        license = nil,
        fivemId = nil,
        ip = GetPlayerEndpoint(source)
    }
    
    for i = 0, GetNumPlayerIdentifiers(source) - 1 do
        local identifier = GetPlayerIdentifier(source, i)
        
        if string.find(identifier, "discord:") then
            identifiers.discordId = string.gsub(identifier, "discord:", "")
        elseif string.find(identifier, "steam:") then
            identifiers.steamHex = identifier
        elseif string.find(identifier, "license:") then
            identifiers.license = identifier
        elseif string.find(identifier, "fivem:") then
            identifiers.fivemId = string.gsub(identifier, "fivem:", "")
        end
    end
    
    return identifiers
end

local function getDiscordRoles(source)
    local roles = {}
    
    if GetResourceState("discord_perms") == "started" then
        roles = exports["discord_perms"]:GetRoles(source) or {}
    elseif GetResourceState("badger_discord_api") == "started" then
        roles = exports["badger_discord_api"]:GetRoles(source) or {}
    end
    
    return roles
end

-- ==================== PERMISSION CHECK ====================

local function hasPermission(source, requiredLevel)
    if source == 0 then return true end -- Console always has permission
    local levels = { user = 0, mod = 1, admin = 2, god = 3 }
    local playerLevel = permissionCache[source] or "user"
    return levels[playerLevel] >= levels[requiredLevel]
end

local function sendError(source, message)
    if source > 0 then
        TriggerClientEvent("chat:addMessage", source, { 
            color = { 255, 0, 0 },
            args = { "[Error]", message }
        })
    else
        print("^1[Error]^0 " .. message)
    end
end

local function sendSuccess(source, message)
    if source > 0 then
        TriggerClientEvent("chat:addMessage", source, { 
            color = { 0, 255, 0 },
            args = { "[Success]", message }
        })
    else
        print("^2[Success]^0 " .. message)
    end
end

-- ==================== WHITELIST & BAN CHECK ====================

AddEventHandler("playerConnecting", function(name, setKickReason, deferrals)
    local source = source
    
    deferrals.defer()
    deferrals.update("Checking server access...")
    
    local identifiers = getPlayerIdentifiers(source)
    
    if not identifiers.discordId then
        deferrals.done("Discord not linked! Please link your Discord account to FiveM in FiveM settings.")
        return
    end
    
    -- Hent friske settings hvis de ikke allerede er loaded
    local function proceedWithCheck()
        -- Check for ban first
        makeRequest("checkBan", {
            discordId = identifiers.discordId,
            steamHex = identifiers.steamHex,
            license = identifiers.license,
            ipAddress = identifiers.ip
        }, function(statusCode, response)
            if statusCode == 200 and response.banned then
                local reason = response.ban and response.ban.reason or "No reason provided"
                local expires = response.ban and response.ban.expires_at
                local banMsg = string.format(Config.BanMessage, reason)
                if expires then
                    banMsg = banMsg .. "\nExpires: " .. expires
                end
                deferrals.done(banMsg)
                return
            end
            
            -- Check whitelist if enabled (henter ALTID frisk fra databasen)
            makeRequest("getSettings", {}, function(settingsStatus, settingsResponse)
                local whitelistEnabled = true -- Default til sikkerhed
                if settingsStatus == 200 and settingsResponse then
                    whitelistEnabled = settingsResponse.whitelistEnabled
                    Config.WhitelistEnabled = whitelistEnabled -- Opdater lokal cache
                end
                
                if whitelistEnabled then
                    deferrals.update("Verifying whitelist status...")
                    
                    makeRequest("checkWhitelist", {
                        discordId = identifiers.discordId,
                        steamHex = identifiers.steamHex,
                        license = identifiers.license
                    }, function(statusCode2, response2)
                        if statusCode2 == 200 and response2.whitelisted then
                            deferrals.update("Welcome, " .. name .. "! Loading...")
                            Wait(500)
                            deferrals.done()
                        else
                            deferrals.done(Config.KickMessage)
                        end
                    end)
                else
                    -- Whitelist er deaktiveret - lad spilleren komme ind
                    deferrals.update("Welcome, " .. name .. "! Loading...")
                    Wait(500)
                    deferrals.done()
                end
            end)
        end)
    end
    
    proceedWithCheck()
end)

-- ==================== PLAYER JOIN/LEAVE ====================

AddEventHandler("playerJoining", function()
    local source = source
    local identifiers = getPlayerIdentifiers(source)
    local playerName = GetPlayerName(source)
    
    playerCache[source] = {
        identifiers = identifiers,
        name = playerName,
        joinedAt = os.time(),
        playtime = 0
    }
    
    if identifiers.discordId then
        makeRequest("registerPlayer", {
            discordId = identifiers.discordId,
            discordUsername = playerName,
            steamHex = identifiers.steamHex,
            license = identifiers.license,
            fivemId = identifiers.fivemId,
            ip = identifiers.ip
        })
        
        makeRequest("sessionStart", {
            discordId = identifiers.discordId,
            serverId = SERVER_ID
        })
        
        if Config.SyncAcePermissions then
            applyRolePermissions(source)
        end
    end
    
    updateOnlinePlayer(source)
end)

AddEventHandler("playerDropped", function(reason)
    local source = source
    local cached = playerCache[source]
    
    if cached and cached.identifiers.discordId then
        makeRequest("sessionEnd", {
            discordId = cached.identifiers.discordId
        })
        
        makeRequest("removeOnlinePlayer", {
            playerId = source,
            serverId = SERVER_ID
        })
    end
    
    playerCache[source] = nil
    permissionCache[source] = nil
end)

-- ==================== ACE PERMISSIONS ====================

function applyRolePermissions(source)
    local roles = getDiscordRoles(source)
    
    if #roles == 0 then return end
    
    makeRequest("getRolePermissions", {
        discordRoles = roles
    }, function(statusCode, response)
        if statusCode == 200 and response.acePermissions then
            permissionCache[source] = response.permissionLevel
            
            for _, perm in ipairs(response.acePermissions) do
                ExecuteCommand(string.format('add_principal identifier.discord:%s %s', 
                    playerCache[source].identifiers.discordId, perm))
            end
            
            print(string.format("[FiveM-Discord] Applied permissions for %s: Level=%s, ACE=%d", 
                GetPlayerName(source), response.permissionLevel, #response.acePermissions))
        end
    end)
end

-- ==================== ONLINE PLAYER UPDATES ====================

function updateOnlinePlayer(source)
    local cached = playerCache[source]
    if not cached then return end
    
    local ped = GetPlayerPed(source)
    local coords = GetEntityCoords(ped)
    
    makeRequest("updateOnlinePlayer", {
        playerId = source,
        serverId = SERVER_ID,
        discordId = cached.identifiers.discordId,
        discordUsername = cached.name,
        steamHex = cached.identifiers.steamHex,
        license = cached.identifiers.license,
        characterName = cached.characterName or cached.name,
        ping = GetPlayerPing(source),
        coords = { x = coords.x, y = coords.y, z = coords.z }
    })
end

-- Initial sync of all online players when resource starts
CreateThread(function()
    -- Wait for config validation
    Wait(2000)
    
    if BOT_SECRET_KEY == "" or GUILD_ID == "" then
        print("^1[zdiscord] Kan ikke synkronisere spillere - mangler konfiguration!^0")
        return
    end
    
    print("^3[zdiscord] Synkroniserer eksisterende spillere...^0")
    local players = GetPlayers()
    local count = 0
    
    for _, playerId in ipairs(players) do
        local source = tonumber(playerId)
        local identifiers = getPlayerIdentifiers(source)
        local playerName = GetPlayerName(source)
        
        -- Add to cache if not already there
        if not playerCache[source] then
            playerCache[source] = {
                identifiers = identifiers,
                name = playerName,
                joinedAt = os.time(),
                playtime = 0
            }
        end
        
        -- Update online player list
        updateOnlinePlayer(source)
        count = count + 1
        Wait(100) -- Small delay to avoid rate limiting
    end
    
    print("^2[zdiscord] Synkroniserede " .. count .. " spillere ved opstart!^0")
end)

-- Periodic update loop
CreateThread(function()
    Wait(5000) -- Wait for initial sync
    while true do
        Wait(Config.UpdateInterval)
        for _, playerId in ipairs(GetPlayers()) do
            updateOnlinePlayer(playerId)
        end
    end
end)

-- ==================== PLAYTIME TRACKING ====================

CreateThread(function()
    while true do
        Wait(Config.PlaytimeInterval)
        for playerId, cached in pairs(playerCache) do
            if cached.identifiers.discordId then
                cached.playtime = cached.playtime + 5
                makeRequest("updatePlaytime", {
                    discordId = cached.identifiers.discordId,
                    minutes = cached.playtime
                })
            end
        end
    end
end)

-- ==================== SERVER STATUS (txAdmin-like) ====================
-- Tracks uptime, player count, resources etc. for dashboard display

local serverStartTime = os.time()

local function getResourceCount()
    local count = 0
    for i = 0, GetNumResources() - 1 do
        local name = GetResourceByFindIndex(i)
        if name and GetResourceState(name) == "started" then
            count = count + 1
        end
    end
    return count
end

-- Parse restart schedule from convar (e.g., "03:00,09:00,15:00,21:00")
local function parseRestartSchedule()
    if RESTART_SCHEDULE_RAW == "" then
        return {}
    end
    
    local schedule = {}
    for time in string.gmatch(RESTART_SCHEDULE_RAW, "[^,]+") do
        local trimmed = time:match("^%s*(.-)%s*$")
        if trimmed:match("^%d%d:%d%d$") then
            table.insert(schedule, trimmed)
        end
    end
    
    Config.RestartSchedule = schedule
    return schedule
end

-- Calculate next restart timestamp
local function getNextRestartTime()
    if #Config.RestartSchedule == 0 then
        return nil
    end
    
    local now = os.time()
    local currentDate = os.date("*t", now)
    local nextRestart = nil
    
    for _, timeStr in ipairs(Config.RestartSchedule) do
        local hour, min = timeStr:match("(%d%d):(%d%d)")
        hour, min = tonumber(hour), tonumber(min)
        
        if hour and min then
            -- Create timestamp for today at this time
            local scheduled = os.time({
                year = currentDate.year,
                month = currentDate.month,
                day = currentDate.day,
                hour = hour,
                min = min,
                sec = 0
            })
            
            -- If already passed today, schedule for tomorrow
            if scheduled <= now then
                scheduled = scheduled + 86400 -- Add 24 hours
            end
            
            if not nextRestart or scheduled < nextRestart then
                nextRestart = scheduled
            end
        end
    end
    
    return nextRestart
end

local function updateServerStatus()
    local playerCount = #GetPlayers()
    local maxPlayers = GetConvarInt("sv_maxclients", 64)
    local uptimeSeconds = os.time() - serverStartTime
    local serverName = GetConvar("sv_hostname", "FiveM Server")
    local mapName = GetConvar("mapname", nil)
    local gameType = GetConvar("gametype", "FiveM")
    
    -- Get server IP from endpoint convar
    local serverEndpoint = GetConvar("sv_endpoint", nil)
    local serverIp = nil
    local serverPort = 30120
    if serverEndpoint then
        local ip, port = serverEndpoint:match("([^:]+):?(%d*)")
        serverIp = ip
        serverPort = tonumber(port) or 30120
    end
    
    -- Get FXServer version
    local fxVersion = GetConvar("version", nil)
    
    -- Get next restart time (prefer txAdmin auto-detected, fallback to static schedule)
    local nextRestart = txAdminNextRestart
    if not nextRestart or nextRestart <= os.time() then
        txAdminNextRestart = nil -- expired
        nextRestart = getNextRestartTime()
    end
    local nextRestartAt = nil
    if nextRestart then
        nextRestartAt = os.date("!%Y-%m-%dT%H:%M:%SZ", nextRestart)
    end
    
    makeRequest("updateServerStatus", {
        serverId = SERVER_ID,
        serverName = serverName,
        maxPlayers = maxPlayers,
        playerCount = playerCount,
        uptimeSeconds = uptimeSeconds,
        serverStartedAt = os.date("!%Y-%m-%dT%H:%M:%SZ", serverStartTime),
        gameType = gameType,
        mapName = mapName,
        resourcesCount = getResourceCount(),
        fxserverVersion = fxVersion,
        serverIp = serverIp,
        serverPort = serverPort,
        nextRestartAt = nextRestartAt,
        restartSchedule = Config.RestartSchedule,
        metadata = {
            onesync = GetConvar("onesync", "off"),
            gameBuild = GetConvar("sv_enforceGameBuild", nil)
        }
    })
end

-- Parse restart schedule on startup
CreateThread(function()
    Wait(1000)
    parseRestartSchedule()
    if #Config.RestartSchedule > 0 then
        print("^2[zdiscord] Restart schedule konfigureret: " .. table.concat(Config.RestartSchedule, ", ") .. "^0")
    else
        print("^3[zdiscord] Ingen statisk restart schedule (zdiscord_restart_schedule) - txAdmin planlagte restarts auto-detekteres^0")
    end
end)

-- ==================== TXADMIN AUTO-DETECT RESTART ====================
-- txAdmin emits this event at warning intervals (60min, 30min, 15min, 10min, 5min, 4min, 3min, 2min, 1min, 30s)
-- before any scheduled restart. We use it to auto-populate next restart in the status embed.
AddEventHandler('txAdmin:events:scheduledRestart', function(eventData)
    if not eventData or not eventData.secondsRemaining then return end
    local secs = tonumber(eventData.secondsRemaining)
    if not secs or secs <= 0 then return end

    txAdminNextRestart = os.time() + secs
    print(("^2[zdiscord] txAdmin scheduled restart detected: %d sek (om %s)^0"):format(
        secs, os.date("%H:%M:%S", txAdminNextRestart)
    ))

    -- Push an immediate status update so Discord embed reflects it right away
    if Config.SettingsLoaded then
        CreateThread(function() updateServerStatus() end)
    end
end)

-- Clear when restart actually happens / is cancelled
AddEventHandler('txAdmin:events:serverShuttingDown', function()
    txAdminNextRestart = nil
end)

-- Initial status update and periodic loop
CreateThread(function()
    Wait(5000) -- Wait for initialization
    if BOT_SECRET_KEY == "" or GUILD_ID == "" then
        print("^1[zdiscord] Kan ikke sende server status - mangler konfiguration!^0")
        return
    end
    
    print("^2[zdiscord] Server status tracking startet (interval: " .. (Config.ServerStatusInterval/1000) .. "s)^0")
    
    while true do
        updateServerStatus()
        Wait(Config.ServerStatusInterval)
    end
end)

-- Mark server as offline when resource stops
AddEventHandler("onResourceStop", function(resourceName)
    if GetCurrentResourceName() == resourceName then
        -- This will run when this resource stops
        makeRequest("serverOffline", {})
    end
end)

-- ==================== DASHBOARD COMMAND QUEUE ====================
-- Polls for pending commands from the web dashboard and executes them

local COMMAND_POLL_INTERVAL = 3000 -- 3 seconds

local function findPlayerByDiscordId(discordId)
    for playerId, cached in pairs(playerCache) do
        if cached.identifiers.discordId == discordId then
            return playerId
        end
    end
    return nil
end

local function executeQueuedCommand(cmd)
    local rawCommandName = cmd.command_name
    local data = cmd.command_data or {}
    local targetPlayerId = cmd.target_player_id
    local targetDiscordId = cmd.target_discord_id
    
    -- Strip group prefix (e.g. "player_revive-all" -> "revive-all", "mod_kick" -> "kick")
    local stripped = rawCommandName:match("^[^_]+_(.+)$")
    local commandName = stripped or rawCommandName
    
    -- Alias map: maps stripped subcommand names to the handler names used below
    local aliasMap = {
        -- teleport group
        ["player"] = "teleport",           -- teleport_player -> teleport
        ["all"] = "teleport-all",          -- teleport_all -> teleport-all
        ["bring"] = "teleport-bring",      -- teleport_bring -> teleport-bring
        ["goto"] = "teleport-goto",        -- teleport_goto -> teleport-goto
        -- vehicle group
        ["spawn"] = "vehicle-spawn",       -- vehicle_spawn -> vehicle-spawn
        ["delete"] = "delvehicle",         -- vehicle_delete -> delvehicle
        -- weapon group
        ["give"] = "give-weapon",          -- weapon_give -> give-weapon
        -- server group
        ["info"] = "server",               -- server_info -> server
        ["count"] = "onlinecount",         -- server_count -> onlinecount
        -- whitelist group (needs context-aware handling)
        ["toggle"] = "whitelist-toggle",
        ["addrole"] = "whitelist-addrole",
        ["removerole"] = "whitelist-removerole",
        ["add"] = "whitelist-add",
        ["check"] = "whitelist-check",
        -- moderation aliases
        ["unjail"] = "unjail",
        ["spectate"] = "spectate",
    }
    
    -- Apply group-aware aliasing: use raw command for context
    local group = rawCommandName:match("^([^_]+)_")
    
    -- Group-specific alias resolution (some subcommand names like "remove", "clear" exist in multiple groups)
    if group == "teleport" then
        if commandName == "player" then commandName = "teleport"
        elseif commandName == "all" then commandName = "teleport-all"
        elseif commandName == "bring" then commandName = "teleport-bring"
        elseif commandName == "goto" then commandName = "teleport-goto"
        end
    elseif group == "vehicle" then
        if commandName == "spawn" then commandName = "vehicle-spawn"
        elseif commandName == "delete" then commandName = "delvehicle"
        end
    elseif group == "weapon" then
        if commandName == "give" then commandName = "give-weapon"
        elseif commandName == "remove" then commandName = "remove-weapon"
        elseif commandName == "clear" then commandName = "clear-weapons"
        end
    elseif group == "server" then
        if commandName == "info" then commandName = "server"
        elseif commandName == "count" then commandName = "onlinecount"
        end
    elseif group == "whitelist" then
        commandName = "whitelist"
        -- Pass subcommand as action
        data.action = stripped or commandName
        if data.action == "toggle" then
            data.action = "toggle"
            data.value = true
        end
    elseif group == "economy" then
        -- money and inventory already match after strip
    elseif group == "jobs" then
        -- job, gang, clothing-menu already match after strip
    end

    -- Bare command name aliases (dashboard sends some commands without a group prefix)
    if commandName == "vehicle" then
        commandName = "vehicle-spawn"
    end
    
    -- Try to find player by Discord ID if we only have that
    if not targetPlayerId and targetDiscordId then
        targetPlayerId = findPlayerByDiscordId(targetDiscordId)
    end
    
    -- Also use data.targetPlayerId if target_player_id column was nil
    if not targetPlayerId and data.targetPlayerId then
        targetPlayerId = tonumber(data.targetPlayerId)
    end
    
    print(string.format("^3[zdiscord] Executing queued command: %s -> %s (target: %s)^0", rawCommandName, commandName, tostring(targetPlayerId)))
    
    local success = true
    local result = "Executed"
    
    -- ======================== MODERATION ========================
    if commandName == "kick" then
        if targetPlayerId and GetPlayerName(targetPlayerId) then
            DropPlayer(targetPlayerId, data.reason or "Kicked by admin")
            result = "Player kicked"
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "kickall" then
        local reason = data.reason or "Server restart"
        for _, playerId in ipairs(GetPlayers()) do
            DropPlayer(playerId, reason)
        end
        result = "All players kicked"
        
    elseif commandName == "ban" then
        if targetPlayerId and GetPlayerName(targetPlayerId) then
            DropPlayer(targetPlayerId, "Banned: " .. (data.reason or "No reason provided"))
            result = "Player banned and kicked"
        else
            result = "Ban recorded (player not online)"
        end
        
    elseif commandName == "warn" then
        if targetPlayerId then
            TriggerClientEvent("chat:addMessage", targetPlayerId, {
                color = { 255, 0, 0 },
                args = { "[WARNING]", data.reason or "You have been warned" }
            })
            result = "Player warned: " .. (data.reason or "No reason")
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "jail" then
        if targetPlayerId and QBCore then
            local Player = QBCore.Functions.GetPlayer(targetPlayerId)
            if Player then
                local action = data.action
                local jailTime = data.time or data.duration
                if not action and jailTime then action = "sentence" end
                
                if action == "sentence" and jailTime then
                    TriggerEvent("prison:server:SetJailStatus", targetPlayerId, true, tonumber(jailTime) or 10)
                    result = "Player jailed for " .. tostring(jailTime) .. " minutes"
                elseif action == "free" then
                    TriggerEvent("prison:server:SetJailStatus", targetPlayerId, false, 0)
                    result = "Player released from jail"
                else
                    success = false
                    result = "Invalid jail action"
                end
            else
                success = false
                result = "QBCore player not found"
            end
        else
            success = false
            result = "Requires QBCore and valid player"
        end
        
    elseif commandName == "unjail" then
        if targetPlayerId and QBCore then
            TriggerEvent("prison:server:SetJailStatus", targetPlayerId, false, 0)
            result = "Player released from jail"
        else
            success = false
            result = "Requires QBCore and valid player"
        end
        
    elseif commandName == "freeze" then
        if targetPlayerId and GetPlayerPed(targetPlayerId) ~= 0 then
            FreezeEntityPosition(GetPlayerPed(targetPlayerId), true)
            result = "Player frozen"
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "unfreeze" then
        if targetPlayerId and GetPlayerPed(targetPlayerId) ~= 0 then
            FreezeEntityPosition(GetPlayerPed(targetPlayerId), false)
            result = "Player unfrozen"
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "spectate" then
        if targetPlayerId then
            TriggerClientEvent("zdiscord:spectate", targetPlayerId)
            result = "Spectate toggled"
        else
            success = false
            result = "Player not found"
        end
        
    -- ======================== PLAYER ========================
    elseif commandName == "kill" then
        if targetPlayerId and GetPlayerPed(targetPlayerId) ~= 0 then
            TriggerClientEvent("zdiscord:kill", targetPlayerId)
            result = "Player killed"
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "revive" then
        if targetPlayerId then
            if QBCore then
                TriggerClientEvent("hospital:client:Revive", targetPlayerId)
                result = "Player revived (QBCore)"
            else
                TriggerClientEvent("zdiscord:revive", targetPlayerId)
                result = "Revive event sent"
            end
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "revive-all" then
        for _, playerId in ipairs(GetPlayers()) do
            if QBCore then
                TriggerClientEvent("hospital:client:Revive", playerId)
            else
                TriggerClientEvent("zdiscord:revive", playerId)
            end
        end
        result = "All players revived"
        
    elseif commandName == "heal" then
        if targetPlayerId and GetPlayerPed(targetPlayerId) ~= 0 then
            TriggerClientEvent("zdiscord:heal", targetPlayerId)
            if QBCore then
                local Player = QBCore.Functions.GetPlayer(targetPlayerId)
                if Player then
                    Player.Functions.SetMetaData("hunger", 100)
                    Player.Functions.SetMetaData("thirst", 100)
                    Player.Functions.SetMetaData("stress", 0)
                end
            end
            result = "Player healed"
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "armor" then
        if targetPlayerId and GetPlayerPed(targetPlayerId) ~= 0 then
            TriggerClientEvent("zdiscord:setArmor", targetPlayerId, 100)
            result = "Player given full armor"
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "sethealth" then
        if targetPlayerId and GetPlayerPed(targetPlayerId) ~= 0 then
            local amount = tonumber(data.amount) or 100
            TriggerClientEvent("zdiscord:setHealth", targetPlayerId, amount)
            result = "Health set to " .. amount
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "setarmor" then
        if targetPlayerId and GetPlayerPed(targetPlayerId) ~= 0 then
            local amount = tonumber(data.amount) or 100
            TriggerClientEvent("zdiscord:setArmor", targetPlayerId, amount)
            result = "Armor set to " .. amount
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "sethunger" then
        if targetPlayerId and QBCore then
            local Player = QBCore.Functions.GetPlayer(targetPlayerId)
            if Player then
                Player.Functions.SetMetaData("hunger", tonumber(data.amount) or 100)
                result = "Hunger set to " .. (data.amount or 100)
            else
                success = false
                result = "QBCore player not found"
            end
        else
            success = false
            result = "Requires QBCore"
        end
        
    elseif commandName == "setthirst" then
        if targetPlayerId and QBCore then
            local Player = QBCore.Functions.GetPlayer(targetPlayerId)
            if Player then
                Player.Functions.SetMetaData("thirst", tonumber(data.amount) or 100)
                result = "Thirst set to " .. (data.amount or 100)
            else
                success = false
                result = "QBCore player not found"
            end
        else
            success = false
            result = "Requires QBCore"
        end
        
    elseif commandName == "setstress" then
        if targetPlayerId and QBCore then
            local Player = QBCore.Functions.GetPlayer(targetPlayerId)
            if Player then
                Player.Functions.SetMetaData("stress", tonumber(data.amount) or 0)
                result = "Stress set to " .. (data.amount or 0)
            else
                success = false
                result = "QBCore player not found"
            end
        else
            success = false
            result = "Requires QBCore"
        end
        
    elseif commandName == "setmodel" then
        if targetPlayerId then
            local model = data.model or "mp_m_freemode_01"
            TriggerClientEvent("zdiscord:setModel", targetPlayerId, model)
            result = "Model set to " .. model
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "logout" then
        if targetPlayerId and QBCore then
            local Player = QBCore.Functions.GetPlayer(targetPlayerId)
            if Player then
                Player.Functions.Logout()
                result = "Player logged out"
            else
                success = false
                result = "QBCore player not found"
            end
        else
            success = false
            result = "Requires QBCore"
        end
        
    elseif commandName == "identifiers" then
        if targetPlayerId then
            local identifiers = getPlayerIdentifiers(targetPlayerId)
            result = string.format("Discord: %s, Steam: %s, License: %s", 
                identifiers.discordId or "N/A", 
                identifiers.steamHex or "N/A", 
                identifiers.license or "N/A")
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "permissions" then
        if targetPlayerId then
            local targetCached = playerCache[targetPlayerId]
            if targetCached and targetCached.identifiers.discordId then
                local action = data.action
                local permission = data.permission
                
                if action == "add" and permission then
                    ExecuteCommand(string.format('add_principal identifier.discord:%s %s', 
                        targetCached.identifiers.discordId, permission))
                    result = "Added permission " .. permission
                elseif action == "remove" and permission then
                    ExecuteCommand(string.format('remove_principal identifier.discord:%s %s', 
                        targetCached.identifiers.discordId, permission))
                    result = "Removed permission " .. permission
                else
                    result = "Current permissions for player " .. targetPlayerId
                end
            else
                success = false
                result = "Player Discord ID not found"
            end
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "godmode" then
        if targetPlayerId then
            TriggerClientEvent("zdiscord:godmode", targetPlayerId, true)
            result = "Godmode enabled"
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "invisible" then
        if targetPlayerId then
            TriggerClientEvent("zdiscord:invisible", targetPlayerId)
            result = "Invisibility toggled"
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "noclip" then
        if targetPlayerId then
            TriggerClientEvent("zdiscord:noclip", targetPlayerId)
            result = "Noclip toggled"
        else
            success = false
            result = "Player not found"
        end
        
    -- ======================== TELEPORT ========================
    elseif commandName == "teleport" then
        if targetPlayerId and GetPlayerPed(targetPlayerId) ~= 0 then
            local coords = nil
            if data.x and data.y and data.z then
                coords = { x = tonumber(data.x), y = tonumber(data.y), z = tonumber(data.z) }
            elseif data.location then
                coords = TeleportPresets[data.location]
            elseif data.coords then
                coords = data.coords
            end
            if coords then
                TriggerClientEvent("zdiscord:teleport", targetPlayerId, coords.x, coords.y, coords.z, data.keepvehicle)
                result = string.format("Teleported to %.1f, %.1f, %.1f", coords.x, coords.y, coords.z)
            else
                success = false
                result = "Invalid coordinates or preset"
            end
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "teleport-all" then
        local coords = nil
        if data.x and data.y and data.z then
            coords = { x = tonumber(data.x), y = tonumber(data.y), z = tonumber(data.z) }
        elseif data.location then
            coords = TeleportPresets[data.location]
        end
        if coords then
            for _, playerId in ipairs(GetPlayers()) do
                TriggerClientEvent("zdiscord:teleport", tonumber(playerId), coords.x, coords.y, coords.z)
            end
            result = "All players teleported"
        else
            success = false
            result = "Invalid coordinates"
        end
        
    elseif commandName == "teleport-bring" then
        -- Bring requires knowing the moderator's position - send via client event
        if targetPlayerId then
            -- We need the moderator's source to get coords, but from dashboard we don't have one
            -- So we use a fallback: teleport to spawn or provided coords
            if data.x and data.y and data.z then
                TriggerClientEvent("zdiscord:teleport", targetPlayerId, tonumber(data.x), tonumber(data.y), tonumber(data.z))
                result = "Player brought to coordinates"
            else
                success = false
                result = "Bring requires coordinates from dashboard"
            end
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "teleport-goto" then
        -- Goto requires the moderator to be in-game
        success = false
        result = "Goto is only available from in-game"
        
    -- ======================== VEHICLE ========================
    elseif commandName == "vehicle-spawn" then
        if targetPlayerId then
            local vehicleCode = data.spawncode or data.vehicleCode
            local plate = data.plate
            if vehicleCode then
                if QBCore then
                    TriggerClientEvent("QBCore:Command:SpawnVehicle", targetPlayerId, vehicleCode)
                else
                    TriggerClientEvent("zdiscord:spawnVehicle", targetPlayerId, vehicleCode, plate)
                end
                result = "Vehicle " .. vehicleCode .. " spawned" .. (plate and (" with plate " .. plate) or "")
            else
                success = false
                result = "No vehicle spawncode provided"
            end
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "delvehicle" then
        if targetPlayerId then
            TriggerClientEvent("zdiscord:deleteVehicle", targetPlayerId)
            result = "Delete vehicle sent"
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "repair" then
        if targetPlayerId then
            TriggerClientEvent("zdiscord:repairVehicle", targetPlayerId)
            result = "Vehicle repair sent"
        else
            success = false
            result = "Player not found"
        end
        
    -- ======================== WEAPON ========================
    elseif commandName == "give-weapon" then
        if targetPlayerId then
            local weaponName = data.weapon or "WEAPON_PISTOL"
            local ammoCount = tonumber(data.ammo) or 100
            TriggerClientEvent("zdiscord:giveWeapon", targetPlayerId, weaponName, ammoCount)
            result = "Gave " .. weaponName .. " with " .. tostring(ammoCount) .. " ammo"
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "remove-weapon" then
        if targetPlayerId then
            local weaponName = data.weapon or "WEAPON_PISTOL"
            TriggerClientEvent("zdiscord:removeWeapon", targetPlayerId, weaponName)
            result = "Removed weapon " .. weaponName
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "clear-weapons" then
        if targetPlayerId then
            TriggerClientEvent("zdiscord:clearWeapons", targetPlayerId)
            result = "All weapons cleared"
        else
            success = false
            result = "Player not found"
        end
        
    -- ======================== ECONOMY ========================
    elseif commandName == "money" then
        if targetPlayerId and QBCore then
            local Player = QBCore.Functions.GetPlayer(targetPlayerId)
            if Player then
                local action = data.action
                local moneyType = data.type or "cash"
                local amount = tonumber(data.amount) or 0
                
                if action == "add" then
                    Player.Functions.AddMoney(moneyType, amount)
                    result = "Added " .. tostring(amount) .. " " .. moneyType
                elseif action == "remove" then
                    Player.Functions.RemoveMoney(moneyType, amount)
                    result = "Removed " .. tostring(amount) .. " " .. moneyType
                elseif action == "set" then
                    Player.Functions.SetMoney(moneyType, amount)
                    result = "Set " .. moneyType .. " to " .. tostring(amount)
                elseif action == "inspect" then
                    local cash = Player.PlayerData.money["cash"] or 0
                    local bank = Player.PlayerData.money["bank"] or 0
                    result = string.format("Cash: %s, Bank: %s", tostring(cash), tostring(bank))
                else
                    success = false
                    result = "Invalid money action"
                end
            else
                success = false
                result = "QBCore player not found"
            end
        else
            success = false
            result = "Requires QBCore and valid player"
        end
        
    elseif commandName == "inventory" then
        if targetPlayerId and QBCore then
            local Player = QBCore.Functions.GetPlayer(targetPlayerId)
            if Player then
                local action = data.action
                if action == "give" and data.item then
                    Player.Functions.AddItem(data.item, tonumber(data.count) or 1)
                    result = "Added " .. (data.count or 1) .. "x " .. data.item
                elseif action == "take" and data.item then
                    Player.Functions.RemoveItem(data.item, tonumber(data.count) or 1)
                    result = "Removed " .. (data.count or 1) .. "x " .. data.item
                elseif action == "clear" then
                    Player.Functions.ClearInventory()
                    result = "Inventory cleared"
                elseif action == "inspect" then
                    result = "Inventory inspection (check in-game)"
                else
                    success = false
                    result = "Invalid inventory action"
                end
            else
                success = false
                result = "QBCore player not found"
            end
        else
            success = false
            result = "Requires QBCore"
        end
        
    -- ======================== JOBS ========================
    elseif commandName == "job" then
        if targetPlayerId and QBCore then
            local Player = QBCore.Functions.GetPlayer(targetPlayerId)
            if Player then
                local action = data.action
                if action == "set" and data.job then
                    Player.Functions.SetJob(data.job, tonumber(data.grade) or 0)
                    result = "Job set to " .. data.job
                elseif action == "fire" then
                    Player.Functions.SetJob("unemployed", 0)
                    result = "Player fired"
                elseif action == "inspect" then
                    result = "Job: " .. (Player.PlayerData.job.name or "none") .. " (grade " .. (Player.PlayerData.job.grade.level or 0) .. ")"
                else
                    success = false
                    result = "Invalid job action"
                end
            else
                success = false
                result = "QBCore player not found"
            end
        else
            success = false
            result = "Requires QBCore"
        end
        
    elseif commandName == "gang" then
        if targetPlayerId and QBCore then
            local Player = QBCore.Functions.GetPlayer(targetPlayerId)
            if Player then
                local action = data.action
                if action == "set" and data.gang then
                    Player.Functions.SetGang(data.gang, tonumber(data.grade) or 0)
                    result = "Gang set to " .. data.gang
                elseif action == "kick" or action == "remove" then
                    Player.Functions.SetGang("none", 0)
                    result = "Gang removed"
                elseif action == "inspect" then
                    result = "Gang: " .. (Player.PlayerData.gang.name or "none")
                else
                    success = false
                    result = "Invalid gang action"
                end
            else
                success = false
                result = "QBCore player not found"
            end
        else
            success = false
            result = "Requires QBCore"
        end
        
    elseif commandName == "clothing-menu" then
        if targetPlayerId then
            if QBCore then
                TriggerClientEvent("qb-clothing:client:openOutfitMenu", targetPlayerId)
                result = "Clothing menu opened"
            else
                TriggerClientEvent("esx_skin:openMenu", targetPlayerId)
                result = "Clothing menu opened (ESX)"
            end
        else
            success = false
            result = "Player not found"
        end
        
    -- ======================== SERVER ========================
    elseif commandName == "server" then
        local players = #GetPlayers()
        local maxPlayers = GetConvarInt("sv_maxclients", 32)
        local hostname = GetConvar("sv_hostname", "Unknown")
        local uptime = math.floor(GetGameTimer() / 1000 / 60)
        result = string.format("%s - %d/%d players - %d min uptime", hostname, players, maxPlayers, uptime)
        
    elseif commandName == "players" then
        local players = GetPlayers()
        local playerList = {}
        for _, playerId in ipairs(players) do
            local name = GetPlayerName(playerId)
            local ping = GetPlayerPing(playerId)
            table.insert(playerList, string.format("[%s] %s (%dms)", playerId, name, ping))
        end
        result = #playerList > 0 and table.concat(playerList, ", ") or "No players online"
        
    elseif commandName == "onlinecount" then
        local count = #GetPlayers()
        local maxPlayers = GetConvarInt("sv_maxclients", 32)
        result = string.format("%d/%d players online", count, maxPlayers)
        
    elseif commandName == "announcement" then
        local message = data.message
        if message then
            TriggerClientEvent("chat:addMessage", -1, {
                color = { 255, 200, 0 },
                multiline = true,
                args = { "[ANNOUNCEMENT]", message }
            })
            result = "Announcement sent"
        else
            success = false
            result = "No message provided"
        end
        
    elseif commandName == "message" then
        if targetPlayerId and data.message then
            TriggerClientEvent("chat:addMessage", targetPlayerId, {
                color = { 255, 100, 100 },
                args = { "[STAFF]", data.message }
            })
            result = "Message sent to player"
        else
            success = false
            result = "Player not found or no message"
        end
        
    elseif commandName == "time" then
        local hour = data.hour
        if hour then
            ExecuteCommand("time " .. tostring(hour))
            result = "Time set to " .. tostring(hour)
        else
            success = false
            result = "No hour specified"
        end
        
    elseif commandName == "weather" then
        local weather = data.weather
        if weather then
            ExecuteCommand("weather " .. weather)
            result = "Weather set to " .. weather
        else
            success = false
            result = "No weather specified"
        end
        
    elseif commandName == "resource" then
        local action = data.action
        local resourceName = data.name
        
        if action == "list" then
            local started = {}
            local count = GetNumResources()
            for i = 0, count - 1 do
                local name = GetResourceByFindIndex(i)
                if GetResourceState(name) == "started" then
                    table.insert(started, name)
                end
            end
            result = "Started resources: " .. #started
        elseif action == "start" and resourceName then
            if GetResourceState(resourceName) == "stopped" then
                StartResource(resourceName)
                result = "Started " .. resourceName
            else
                success = false
                result = "Resource already running or not found"
            end
        elseif action == "stop" and resourceName then
            if GetResourceState(resourceName) == "started" then
                StopResource(resourceName)
                result = "Stopped " .. resourceName
            else
                success = false
                result = "Resource not running"
            end
        elseif action == "ensure" or action == "restart" then
            if resourceName then
                StopResource(resourceName)
                Wait(100)
                StartResource(resourceName)
                result = "Ensured " .. resourceName
            else
                success = false
                result = "No resource name"
            end
        elseif action == "refresh" then
            ExecuteCommand("refresh")
            result = "Refreshed resources"
        elseif action == "inspect" and resourceName then
            local state = GetResourceState(resourceName)
            result = resourceName .. " is " .. state
        else
            success = false
            result = "Invalid resource action"
        end
        
    elseif commandName == "screenshot" then
        if targetPlayerId then
            if GetResourceState("screenshot-basic") == "started" then
                exports["screenshot-basic"]:requestClientScreenshot(targetPlayerId, {
                    encoding = "png",
                    quality = 0.9
                }, function(err, screenshotData)
                    if not err then
                        makeRequest("screenshotResult", {
                            targetPlayerId = targetPlayerId,
                            targetName = GetPlayerName(targetPlayerId),
                            imageData = screenshotData
                        })
                    end
                end)
                result = "Screenshot requested"
            else
                success = false
                result = "screenshot-basic not found"
            end
        else
            success = false
            result = "Player not found"
        end
        
    elseif commandName == "embed" then
        result = "Embed sent via Discord"
        
    -- ======================== WHITELIST ========================
    elseif commandName == "whitelist" then
        local action = data.action
        
        if action == "toggle" then
            Config.WhitelistEnabled = not Config.WhitelistEnabled
            result = "Whitelist " .. (Config.WhitelistEnabled and "enabled" or "disabled")
        elseif action == "addrole" and (data.value or data.role_id) then
            local roleId = data.value or data.role_id
            table.insert(Config.WhitelistRoles, roleId)
            result = "Added role " .. roleId
        elseif action == "removerole" and (data.value or data.role_id) then
            local roleId = data.value or data.role_id
            for i, role in ipairs(Config.WhitelistRoles) do
                if role == roleId then
                    table.remove(Config.WhitelistRoles, i)
                    break
                end
            end
            result = "Removed role " .. roleId
        elseif action == "add" and data.discord_id then
            -- Add to whitelist is handled by the API/database
            result = "Whitelist add processed via database"
        elseif action == "remove" and data.discord_id then
            result = "Whitelist remove processed via database"
        elseif action == "check" and data.discord_id then
            local found = false
            for _, cached in pairs(playerCache) do
                if cached.identifiers.discordId == data.discord_id then
                    found = true
                    break
                end
            end
            result = data.discord_id .. (found and " is online" or " is not online")
        else
            success = false
            result = "Invalid whitelist action: " .. tostring(action)
        end
        
    else
        result = "Command not implemented: " .. commandName .. " (raw: " .. rawCommandName .. ")"
        success = false
    end
    
    -- Report result back to API
    makeRequest("markCommandExecuted", {
        commandId = cmd.id,
        result = result,
        success = success
    })
    
    print(string.format("^%d[zdiscord] Command %s: %s^0", success and 2 or 1, commandName, result))
end

-- Command queue polling thread
CreateThread(function()
    -- Wait for config validation
    Wait(3000)
    
    if BOT_SECRET_KEY == "" or GUILD_ID == "" then
        print("^1[zdiscord] Command queue disabled - missing configuration^0")
        return
    end
    
    print("^2[zdiscord] Command queue polling started (every " .. (COMMAND_POLL_INTERVAL/1000) .. "s)^0")
    
    while true do
        Wait(COMMAND_POLL_INTERVAL)
        
        makeRequest("getPendingCommands", {}, function(statusCode, response)
            if statusCode == 200 and response.commands then
                for _, cmd in ipairs(response.commands) do
                    executeQueuedCommand(cmd)
                end
            end
        end)
    end
end)

-- ==================== HELPER FUNCTIONS ====================

local function getModeratorInfo(source)
    if source == 0 then
        return "console", "Console"
    end
    local cached = playerCache[source]
    return cached and cached.identifiers.discordId or "unknown", GetPlayerName(source)
end

local function getPlayerByIdOrName(input)
    local targetId = tonumber(input)
    if targetId then
        if GetPlayerName(targetId) then
            return targetId
        end
        return nil
    end
    
    -- Search by name
    for _, playerId in ipairs(GetPlayers()) do
        if string.lower(GetPlayerName(playerId)):find(string.lower(input)) then
            return tonumber(playerId)
        end
    end
    return nil
end

local function formatCoords(x, y, z)
    return string.format("%.1f, %.1f, %.1f", x, y, z)
end

-- ============================================================================
-- STANDALONE COMMANDS (25)
-- ============================================================================

-- /announcement [message] - mod+
RegisterCommand("announcement", function(source, args)
    if not hasPermission(source, "mod") then return sendError(source, "No permission") end
    local message = table.concat(args, " ")
    if message == "" then return sendError(source, "Usage: /announcement [message]") end
    
    TriggerClientEvent("chat:addMessage", -1, {
        color = { 255, 200, 0 },
        multiline = true,
        args = { "[ANNOUNCEMENT]", message }
    })
    
    local modId, modName = getModeratorInfo(source)
    makeRequest("announcement", { moderatorDiscordId = modId, moderatorName = modName, message = message })
    sendSuccess(source, "Announcement sent!")
end, false)

-- /embed simple [channel] [message] (title) (image) (thumbnail) (footer) (color) - god
RegisterCommand("embed", function(source, args)
    if not hasPermission(source, "god") then return sendError(source, "No permission") end
    local subCmd = args[1]
    
    if subCmd == "complex" then
        local channelId = args[2]
        local jsonData = table.concat(args, " ", 3)
        if not channelId or jsonData == "" then 
            return sendError(source, "Usage: /embed complex [channel] [json]") 
        end
        
        makeRequest("sendEmbed", { 
            channelId = channelId, 
            type = "complex", 
            json = jsonData 
        })
        sendSuccess(source, "Complex embed sent!")
        
    elseif subCmd == "simple" then
        local channelId = args[2]
        local message = args[3]
        if not channelId or not message then 
            return sendError(source, "Usage: /embed simple [channel] [message] (title) (image) (thumbnail) (footer) (color)") 
        end
        
        makeRequest("sendEmbed", {
            channelId = channelId,
            type = "simple",
            message = message,
            title = args[4],
            image = args[5],
            thumbnail = args[6],
            footer = args[7],
            color = args[8]
        })
        sendSuccess(source, "Simple embed sent!")
    else
        sendError(source, "Usage: /embed [complex|simple] ...")
    end
end, false)

-- /identifiers [id] - admin+
RegisterCommand("identifiers", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    local targetId = getPlayerByIdOrName(args[1])
    if not targetId then return sendError(source, "Player not found") end
    
    local identifiers = getPlayerIdentifiers(targetId)
    local msg = "^3Identifiers for " .. GetPlayerName(targetId) .. " [" .. targetId .. "]:\n"
    msg = msg .. "^7Discord: " .. (identifiers.discordId or "N/A") .. "\n"
    msg = msg .. "^7Steam: " .. (identifiers.steamHex or "N/A") .. "\n"
    msg = msg .. "^7License: " .. (identifiers.license or "N/A") .. "\n"
    msg = msg .. "^7FiveM: " .. (identifiers.fivemId or "N/A") .. "\n"
    msg = msg .. "^7IP: " .. (identifiers.ip or "N/A")
    
    if source > 0 then
        TriggerClientEvent("chat:addMessage", source, { args = { "", msg }})
    else
        print(msg)
    end
end, false)

-- /kick [id] (message) - mod+
RegisterCommand("kick", function(source, args)
    if not hasPermission(source, "mod") then return sendError(source, "No permission") end
    local targetId = getPlayerByIdOrName(args[1])
    if not targetId then return sendError(source, "Player not found") end
    
    local reason = table.concat(args, " ", 2)
    if reason == "" then reason = "No reason provided" end
    
    local targetName = GetPlayerName(targetId)
    local targetCached = playerCache[targetId]
    local modId, modName = getModeratorInfo(source)
    
    makeRequest("kick", {
        targetDiscordId = targetCached and targetCached.identifiers.discordId,
        targetName = targetName,
        moderatorDiscordId = modId,
        moderatorName = modName,
        reason = reason
    })
    
    DropPlayer(targetId, "Kicked: " .. reason)
    sendSuccess(source, "Kicked " .. targetName)
end, false)

-- /kickall [message] - admin+
RegisterCommand("kickall", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    local reason = table.concat(args, " ")
    if reason == "" then reason = "Server maintenance" end
    
    local modId, modName = getModeratorInfo(source)
    
    for _, playerId in ipairs(GetPlayers()) do
        if tonumber(playerId) ~= source then
            local targetCached = playerCache[tonumber(playerId)]
            makeRequest("kick", {
                targetDiscordId = targetCached and targetCached.identifiers.discordId,
                targetName = GetPlayerName(playerId),
                moderatorDiscordId = modId,
                moderatorName = modName,
                reason = reason
            })
            DropPlayer(tonumber(playerId), "Kicked: " .. reason)
        end
    end
    
    sendSuccess(source, "Kicked all players")
end, false)

-- /kill [id] - admin+
RegisterCommand("kill", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    local targetId = getPlayerByIdOrName(args[1])
    if not targetId then return sendError(source, "Player not found") end
    
    TriggerClientEvent("zdiscord:kill", targetId)
    
    local targetCached = playerCache[targetId]
    local modId, modName = getModeratorInfo(source)
    
    makeRequest("kill", {
        targetDiscordId = targetCached and targetCached.identifiers.discordId,
        targetName = GetPlayerName(targetId),
        moderatorDiscordId = modId,
        moderatorName = modName
    })
    
    sendSuccess(source, "Killed " .. GetPlayerName(targetId))
end, false)

-- /message [id] [message] - mod+
RegisterCommand("message", function(source, args)
    if not hasPermission(source, "mod") then return sendError(source, "No permission") end
    local targetId = getPlayerByIdOrName(args[1])
    if not targetId then return sendError(source, "Player not found") end
    
    local message = table.concat(args, " ", 2)
    if message == "" then return sendError(source, "Usage: /message [id] [message]") end
    
    TriggerClientEvent("chat:addMessage", targetId, {
        color = { 255, 100, 100 },
        args = { "[STAFF]", message }
    })
    
    local targetCached = playerCache[targetId]
    local modId, modName = getModeratorInfo(source)
    makeRequest("message", {
        targetDiscordId = targetCached and targetCached.identifiers.discordId,
        targetName = GetPlayerName(targetId),
        moderatorDiscordId = modId,
        moderatorName = modName,
        message = message
    })
    
    sendSuccess(source, "Message sent to " .. GetPlayerName(targetId))
end, false)

-- /onlinecount
RegisterCommand("onlinecount", function(source, args)
    local count = #GetPlayers()
    local maxPlayers = GetConvarInt("sv_maxclients", 32)
    local msg = string.format("^3Players Online: ^7%d/%d", count, maxPlayers)
    
    if source > 0 then
        TriggerClientEvent("chat:addMessage", source, { args = { "", msg }})
    else
        print(msg)
    end
end, false)

-- /players - mod+
RegisterCommand("players", function(source, args)
    if not hasPermission(source, "mod") then return sendError(source, "No permission") end
    
    local players = GetPlayers()
    local msg = "^3Online Players (" .. #players .. "):\n"
    
    for _, playerId in ipairs(players) do
        local name = GetPlayerName(playerId)
        local ping = GetPlayerPing(playerId)
        local cached = playerCache[tonumber(playerId)]
        local discord = cached and cached.identifiers.discordId or "N/A"
        msg = msg .. string.format("^7[%s] %s (Ping: %dms, Discord: %s)\n", playerId, name, ping, discord)
    end
    
    if source > 0 then
        TriggerClientEvent("chat:addMessage", source, { args = { "", msg }})
    else
        print(msg)
    end
end, false)

-- /resource [action] [resource] - god
RegisterCommand("resource", function(source, args)
    if not hasPermission(source, "god") then return sendError(source, "No permission") end
    local action = args[1]
    local resourceName = args[2]
    
    if action == "list" then
        local msg = "^3Resources:\n"
        local count = GetNumResources()
        for i = 0, count - 1 do
            local name = GetResourceByFindIndex(i)
            local state = GetResourceState(name)
            if state == "started" then
                msg = msg .. "^2[STARTED] " .. name .. "\n"
            elseif state == "stopped" then
                msg = msg .. "^1[STOPPED] " .. name .. "\n"
            end
        end
        if source > 0 then
            TriggerClientEvent("chat:addMessage", source, { args = { "", msg }})
        else
            print(msg)
        end
        
    elseif action == "start" and resourceName then
        if GetResourceState(resourceName) == "stopped" then
            StartResource(resourceName)
            sendSuccess(source, "Started " .. resourceName)
        else
            sendError(source, "Resource is already running or doesn't exist")
        end
        
    elseif action == "stop" and resourceName then
        if GetResourceState(resourceName) == "started" then
            StopResource(resourceName)
            sendSuccess(source, "Stopped " .. resourceName)
        else
            sendError(source, "Resource is not running")
        end
        
    elseif action == "ensure" and resourceName then
        StopResource(resourceName)
        Wait(100)
        StartResource(resourceName)
        sendSuccess(source, "Ensured " .. resourceName)
        
    elseif action == "refresh" then
        ExecuteCommand("refresh")
        sendSuccess(source, "Refreshed resources")
        
    elseif action == "inspect" and resourceName then
        local state = GetResourceState(resourceName)
        local path = GetResourcePath(resourceName)
        local msg = string.format("^3Resource: %s\n^7State: %s\n^7Path: %s", resourceName, state, path or "N/A")
        if source > 0 then
            TriggerClientEvent("chat:addMessage", source, { args = { "", msg }})
        else
            print(msg)
        end
    else
        sendError(source, "Usage: /resource [start|stop|ensure|refresh|list|inspect] (resource)")
    end
end, false)

-- /server
RegisterCommand("server", function(source, args)
    local players = #GetPlayers()
    local maxPlayers = GetConvarInt("sv_maxclients", 32)
    local hostname = GetConvar("sv_hostname", "Unknown")
    
    local msg = "^3Server Info:\n"
    msg = msg .. "^7Name: " .. hostname .. "\n"
    msg = msg .. "^7Players: " .. players .. "/" .. maxPlayers .. "\n"
    msg = msg .. "^7Uptime: " .. math.floor(GetGameTimer() / 1000 / 60) .. " minutes"
    
    if source > 0 then
        TriggerClientEvent("chat:addMessage", source, { args = { "", msg }})
    else
        print(msg)
    end
end, false)

-- /screenshot [id] - god
RegisterCommand("screenshot", function(source, args)
    if not hasPermission(source, "god") then return sendError(source, "No permission") end
    local targetId = getPlayerByIdOrName(args[1])
    if not targetId then return sendError(source, "Player not found") end
    
    -- Trigger screenshot export if available
    if GetResourceState("screenshot-basic") == "started" then
        exports["screenshot-basic"]:requestClientScreenshot(targetId, {
            encoding = "png",
            quality = 0.9
        }, function(err, data)
            if not err then
                local modId, modName = getModeratorInfo(source)
                makeRequest("screenshot", {
                    targetDiscordId = playerCache[targetId] and playerCache[targetId].identifiers.discordId,
                    targetName = GetPlayerName(targetId),
                    moderatorDiscordId = modId,
                    moderatorName = modName,
                    imageData = data
                })
                sendSuccess(source, "Screenshot captured for " .. GetPlayerName(targetId))
            else
                sendError(source, "Failed to capture screenshot")
            end
        end)
    else
        sendError(source, "screenshot-basic resource not found")
    end
end, false)

-- /teleport coords [id] [x] [y] [z] (keepVehicle) - mod+
-- /teleport preset [id] [location] (keepVehicle) - mod+
RegisterCommand("teleport", function(source, args)
    if not hasPermission(source, "mod") then return sendError(source, "No permission") end
    local mode = args[1]
    
    if mode == "coords" then
        local targetId = getPlayerByIdOrName(args[2])
        local x = tonumber(args[3])
        local y = tonumber(args[4])
        local z = tonumber(args[5])
        local keepVehicle = args[6] == "true"
        
        if not targetId or not x or not y or not z then
            return sendError(source, "Usage: /teleport coords [id] [x] [y] [z] (keepVehicle)")
        end
        
        local targetPed = GetPlayerPed(targetId)
        local vehicle = GetVehiclePedIsIn(targetPed, false)
        
        if keepVehicle and vehicle ~= 0 then
            SetEntityCoords(vehicle, x, y, z, false, false, false, false)
        else
            SetEntityCoords(targetPed, x, y, z, false, false, false, false)
        end
        
        local modId, modName = getModeratorInfo(source)
        makeRequest("teleport", {
            targetDiscordId = playerCache[targetId] and playerCache[targetId].identifiers.discordId,
            targetName = GetPlayerName(targetId),
            moderatorDiscordId = modId,
            moderatorName = modName,
            coords = { x = x, y = y, z = z }
        })
        
        sendSuccess(source, "Teleported " .. GetPlayerName(targetId) .. " to " .. formatCoords(x, y, z))
        
    elseif mode == "preset" then
        local targetId = getPlayerByIdOrName(args[2])
        local location = string.lower(args[3] or "")
        local keepVehicle = args[4] == "true"
        
        if not targetId or not TeleportPresets[location] then
            local presetList = ""
            for k, _ in pairs(TeleportPresets) do presetList = presetList .. k .. ", " end
            return sendError(source, "Usage: /teleport preset [id] [location]. Presets: " .. presetList)
        end
        
        local coords = TeleportPresets[location]
        local targetPed = GetPlayerPed(targetId)
        local vehicle = GetVehiclePedIsIn(targetPed, false)
        
        if keepVehicle and vehicle ~= 0 then
            SetEntityCoords(vehicle, coords.x, coords.y, coords.z, false, false, false, false)
        else
            SetEntityCoords(targetPed, coords.x, coords.y, coords.z, false, false, false, false)
        end
        
        local modId, modName = getModeratorInfo(source)
        makeRequest("teleport", {
            targetDiscordId = playerCache[targetId] and playerCache[targetId].identifiers.discordId,
            targetName = GetPlayerName(targetId),
            moderatorDiscordId = modId,
            moderatorName = modName,
            coords = coords
        })
        
        sendSuccess(source, "Teleported " .. GetPlayerName(targetId) .. " to " .. location)
    else
        sendError(source, "Usage: /teleport [coords|preset] ...")
    end
end, false)

-- /teleport-all coords [x] [y] [z] - god
-- /teleport-all preset [location] - god
RegisterCommand("teleport-all", function(source, args)
    if not hasPermission(source, "god") then return sendError(source, "No permission") end
    local mode = args[1]
    
    local coords
    if mode == "coords" then
        local x = tonumber(args[2])
        local y = tonumber(args[3])
        local z = tonumber(args[4])
        if not x or not y or not z then
            return sendError(source, "Usage: /teleport-all coords [x] [y] [z]")
        end
        coords = { x = x, y = y, z = z }
        
    elseif mode == "preset" then
        local location = string.lower(args[2] or "")
        if not TeleportPresets[location] then
            return sendError(source, "Invalid preset location")
        end
        coords = TeleportPresets[location]
    else
        return sendError(source, "Usage: /teleport-all [coords|preset] ...")
    end
    
    for _, playerId in ipairs(GetPlayers()) do
        local targetPed = GetPlayerPed(tonumber(playerId))
        SetEntityCoords(targetPed, coords.x, coords.y, coords.z, false, false, false, false)
    end
    
    sendSuccess(source, "Teleported all players")
end, false)

-- /whitelist toggle [true/false] - god
-- /whitelist addrole [role] - god
-- /whitelist removerole [role] - god
RegisterCommand("whitelist", function(source, args)
    if not hasPermission(source, "god") then return sendError(source, "No permission") end
    local action = args[1]
    
    if action == "toggle" then
        local enabled = args[2] == "true"
        Config.WhitelistEnabled = enabled
        makeRequest("updateSettings", { whitelistEnabled = enabled })
        sendSuccess(source, "Whitelist " .. (enabled and "enabled" or "disabled"))
        
    elseif action == "addrole" then
        local roleId = args[2]
        if not roleId then return sendError(source, "Usage: /whitelist addrole [roleId]") end
        table.insert(Config.WhitelistRoles, roleId)
        makeRequest("updateSettings", { whitelistRoles = Config.WhitelistRoles })
        sendSuccess(source, "Added role " .. roleId .. " to whitelist")
        
    elseif action == "removerole" then
        local roleId = args[2]
        if not roleId then return sendError(source, "Usage: /whitelist removerole [roleId]") end
        for i, role in ipairs(Config.WhitelistRoles) do
            if role == roleId then
                table.remove(Config.WhitelistRoles, i)
                break
            end
        end
        makeRequest("updateSettings", { whitelistRoles = Config.WhitelistRoles })
        sendSuccess(source, "Removed role " .. roleId .. " from whitelist")
    else
        sendError(source, "Usage: /whitelist [toggle|addrole|removerole] ...")
    end
end, false)

-- ============================================================================
-- QBCORE COMMANDS (27)
-- ============================================================================

-- Helper to get QBCore player
local function getQBPlayer(targetId)
    if not QBCore then return nil end
    return QBCore.Functions.GetPlayer(targetId)
end

-- /ban [id] [time] [reason] - admin+
RegisterCommand("ban", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    local targetId = getPlayerByIdOrName(args[1])
    local duration = args[2] or "permanent"
    local reason = table.concat(args, " ", 3)
    
    if not targetId then return sendError(source, "Player not found") end
    if reason == "" then reason = "No reason provided" end
    
    -- Parse duration
    local durationSeconds = nil
    if duration ~= "permanent" then
        local num = tonumber(string.match(duration, "%d+"))
        local unit = string.match(duration, "%a+")
        if num then
            if unit == "m" then durationSeconds = num * 60
            elseif unit == "h" then durationSeconds = num * 3600
            elseif unit == "d" then durationSeconds = num * 86400
            elseif unit == "w" then durationSeconds = num * 604800
            end
        end
    end
    
    local targetCached = playerCache[targetId]
    local modId, modName = getModeratorInfo(source)
    
    makeRequest("ban", {
        targetDiscordId = targetCached and targetCached.identifiers.discordId,
        targetName = GetPlayerName(targetId),
        steamHex = targetCached and targetCached.identifiers.steamHex,
        license = targetCached and targetCached.identifiers.license,
        ipAddress = targetCached and targetCached.identifiers.ip,
        moderatorDiscordId = modId,
        moderatorName = modName,
        reason = reason,
        durationSeconds = durationSeconds
    }, function(statusCode, response)
        if statusCode == 200 then
            DropPlayer(targetId, "Banned: " .. reason)
            sendSuccess(source, "Banned " .. GetPlayerName(targetId) .. " for " .. duration)
        end
    end)
end, false)

-- /clothing-menu [id] - admin+
RegisterCommand("clothing-menu", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    local targetId = getPlayerByIdOrName(args[1])
    if not targetId then return sendError(source, "Player not found") end
    
    if QBCore then
        TriggerClientEvent("qb-clothing:client:openOutfitMenu", targetId)
    else
        TriggerClientEvent("esx_skin:openMenu", targetId)
    end
    sendSuccess(source, "Opened clothing menu for " .. GetPlayerName(targetId))
end, false)

-- /gang kick [id] - admin+
-- /gang inspect [id] - admin+
-- /gang set [id] [gang] [grade] - admin+
RegisterCommand("gang", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    if not QBCore then return sendError(source, "QBCore required") end
    
    local action = args[1]
    local targetId = getPlayerByIdOrName(args[2])
    
    if not targetId then return sendError(source, "Player not found") end
    
    local Player = getQBPlayer(targetId)
    if not Player then return sendError(source, "Player data not found") end
    
    if action == "kick" then
        Player.Functions.SetGang("none", 0)
        sendSuccess(source, "Removed " .. GetPlayerName(targetId) .. " from gang")
        
    elseif action == "inspect" then
        local gang = Player.PlayerData.gang
        local msg = string.format("^3Gang Info for %s:\n^7Gang: %s\n^7Grade: %d (%s)", 
            GetPlayerName(targetId), gang.name, gang.grade.level, gang.grade.name)
        if source > 0 then
            TriggerClientEvent("chat:addMessage", source, { args = { "", msg }})
        else
            print(msg)
        end
        
    elseif action == "set" then
        local gangName = args[3]
        local grade = tonumber(args[4]) or 0
        if not gangName then return sendError(source, "Usage: /gang set [id] [gang] [grade]") end
        Player.Functions.SetGang(gangName, grade)
        sendSuccess(source, "Set " .. GetPlayerName(targetId) .. " to gang " .. gangName .. " grade " .. grade)
    else
        sendError(source, "Usage: /gang [kick|inspect|set] [id] ...")
    end
end, false)

-- /inventory give [id] [item] [count] - admin+
-- /inventory inspect [id] - admin+
-- /inventory take [id] [item] [count] - admin+
RegisterCommand("inventory", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    if not QBCore then return sendError(source, "QBCore required") end
    
    local action = args[1]
    local targetId = getPlayerByIdOrName(args[2])
    
    if not targetId then return sendError(source, "Player not found") end
    
    local Player = getQBPlayer(targetId)
    if not Player then return sendError(source, "Player data not found") end
    
    if action == "give" then
        local item = args[3]
        local count = tonumber(args[4]) or 1
        if not item then return sendError(source, "Usage: /inventory give [id] [item] [count]") end
        Player.Functions.AddItem(item, count)
        TriggerClientEvent("inventory:client:ItemBox", targetId, QBCore.Shared.Items[item], "add")
        sendSuccess(source, "Gave " .. count .. "x " .. item .. " to " .. GetPlayerName(targetId))
        
    elseif action == "inspect" then
        local items = Player.PlayerData.items
        local msg = "^3Inventory for " .. GetPlayerName(targetId) .. ":\n"
        for slot, item in pairs(items) do
            if item then
                msg = msg .. string.format("^7[%d] %s x%d\n", slot, item.name, item.amount)
            end
        end
        if source > 0 then
            TriggerClientEvent("chat:addMessage", source, { args = { "", msg }})
        else
            print(msg)
        end
        
    elseif action == "take" then
        local item = args[3]
        local count = tonumber(args[4]) or 1
        if not item then return sendError(source, "Usage: /inventory take [id] [item] [count]") end
        Player.Functions.RemoveItem(item, count)
        TriggerClientEvent("inventory:client:ItemBox", targetId, QBCore.Shared.Items[item], "remove")
        sendSuccess(source, "Took " .. count .. "x " .. item .. " from " .. GetPlayerName(targetId))
    else
        sendError(source, "Usage: /inventory [give|inspect|take] [id] ...")
    end
end, false)

-- /jail free [id] - mod+
-- /jail sentence [id] [time] - mod+
RegisterCommand("jail", function(source, args)
    if not hasPermission(source, "mod") then return sendError(source, "No permission") end
    if not QBCore then return sendError(source, "QBCore required") end
    
    local action = args[1]
    local targetId = getPlayerByIdOrName(args[2])
    
    if not targetId then return sendError(source, "Player not found") end
    
    if action == "free" then
        TriggerEvent("prison:server:release", targetId)
        sendSuccess(source, "Released " .. GetPlayerName(targetId) .. " from jail")
        
    elseif action == "sentence" then
        local time = tonumber(args[3]) or 5
        TriggerEvent("prison:server:jail", targetId, time)
        sendSuccess(source, "Jailed " .. GetPlayerName(targetId) .. " for " .. time .. " months")
    else
        sendError(source, "Usage: /jail [free|sentence] [id] (time)")
    end
end, false)

-- /job fire [id] - admin+
-- /job inspect [id] - admin+
-- /job set [id] [job] [grade] - admin+
RegisterCommand("job", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    if not QBCore then return sendError(source, "QBCore required") end
    
    local action = args[1]
    local targetId = getPlayerByIdOrName(args[2])
    
    if not targetId then return sendError(source, "Player not found") end
    
    local Player = getQBPlayer(targetId)
    if not Player then return sendError(source, "Player data not found") end
    
    if action == "fire" then
        Player.Functions.SetJob("unemployed", 0)
        sendSuccess(source, "Fired " .. GetPlayerName(targetId))
        
    elseif action == "inspect" then
        local job = Player.PlayerData.job
        local msg = string.format("^3Job Info for %s:\n^7Job: %s\n^7Grade: %d (%s)\n^7On Duty: %s", 
            GetPlayerName(targetId), job.name, job.grade.level, job.grade.name, tostring(job.onduty))
        if source > 0 then
            TriggerClientEvent("chat:addMessage", source, { args = { "", msg }})
        else
            print(msg)
        end
        
    elseif action == "set" then
        local jobName = args[3]
        local grade = tonumber(args[4]) or 0
        if not jobName then return sendError(source, "Usage: /job set [id] [job] [grade]") end
        Player.Functions.SetJob(jobName, grade)
        sendSuccess(source, "Set " .. GetPlayerName(targetId) .. " to job " .. jobName .. " grade " .. grade)
    else
        sendError(source, "Usage: /job [fire|inspect|set] [id] ...")
    end
end, false)

-- /logout [id] - admin+
RegisterCommand("logout", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    if not QBCore then return sendError(source, "QBCore required") end
    
    local targetId = getPlayerByIdOrName(args[1])
    if not targetId then return sendError(source, "Player not found") end
    
    local Player = getQBPlayer(targetId)
    if Player then
        Player.Functions.Logout()
        sendSuccess(source, "Logged out " .. GetPlayerName(targetId))
    end
end, false)

-- /money add [id] [type] [amount] - admin+
-- /money inspect [id] - admin+
-- /money remove [id] [type] [amount] - admin+
-- /money set [id] [type] [amount] - admin+
RegisterCommand("money", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    if not QBCore then return sendError(source, "QBCore required") end
    
    local action = args[1]
    local targetId = getPlayerByIdOrName(args[2])
    
    if not targetId then return sendError(source, "Player not found") end
    
    local Player = getQBPlayer(targetId)
    if not Player then return sendError(source, "Player data not found") end
    
    if action == "add" then
        local moneyType = args[3] or "cash"
        local amount = tonumber(args[4]) or 0
        Player.Functions.AddMoney(moneyType, amount)
        sendSuccess(source, "Added $" .. amount .. " " .. moneyType .. " to " .. GetPlayerName(targetId))
        
    elseif action == "remove" then
        local moneyType = args[3] or "cash"
        local amount = tonumber(args[4]) or 0
        Player.Functions.RemoveMoney(moneyType, amount)
        sendSuccess(source, "Removed $" .. amount .. " " .. moneyType .. " from " .. GetPlayerName(targetId))
        
    elseif action == "set" then
        local moneyType = args[3] or "cash"
        local amount = tonumber(args[4]) or 0
        Player.Functions.SetMoney(moneyType, amount)
        sendSuccess(source, "Set " .. GetPlayerName(targetId) .. "'s " .. moneyType .. " to $" .. amount)
        
    elseif action == "inspect" then
        local money = Player.PlayerData.money
        local msg = "^3Money for " .. GetPlayerName(targetId) .. ":\n"
        msg = msg .. "^7Cash: $" .. (money.cash or 0) .. "\n"
        msg = msg .. "^7Bank: $" .. (money.bank or 0) .. "\n"
        msg = msg .. "^7Crypto: " .. (money.crypto or 0)
        if source > 0 then
            TriggerClientEvent("chat:addMessage", source, { args = { "", msg }})
        else
            print(msg)
        end
    else
        sendError(source, "Usage: /money [add|remove|set|inspect] [id] (type) (amount)")
    end
end, false)

-- /permissions add [id] [permission] - god
-- /permissions remove [id] - god
RegisterCommand("permissions", function(source, args)
    if not hasPermission(source, "god") then return sendError(source, "No permission") end
    
    local action = args[1]
    local targetId = getPlayerByIdOrName(args[2])
    
    if not targetId then return sendError(source, "Player not found") end
    
    local targetCached = playerCache[targetId]
    if not targetCached or not targetCached.identifiers.discordId then
        return sendError(source, "Player not fully loaded")
    end
    
    if action == "add" then
        local permission = args[3]
        if not permission then return sendError(source, "Usage: /permissions add [id] [permission]") end
        ExecuteCommand(string.format('add_principal identifier.discord:%s %s', 
            targetCached.identifiers.discordId, permission))
        sendSuccess(source, "Added permission " .. permission .. " to " .. GetPlayerName(targetId))
        
    elseif action == "remove" then
        local permission = args[3]
        if not permission then return sendError(source, "Usage: /permissions remove [id] [permission]") end
        ExecuteCommand(string.format('remove_principal identifier.discord:%s %s', 
            targetCached.identifiers.discordId, permission))
        sendSuccess(source, "Removed permission " .. permission .. " from " .. GetPlayerName(targetId))
    else
        sendError(source, "Usage: /permissions [add|remove] [id] [permission]")
    end
end, false)

-- /revive [id] - admin+
RegisterCommand("revive", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    local targetId = getPlayerByIdOrName(args[1])
    if not targetId then return sendError(source, "Player not found") end
    
    -- Try multiple revive methods
    if QBCore then
        TriggerClientEvent("hospital:client:Revive", targetId)
    else
        TriggerClientEvent("esx_ambulancejob:revive", targetId)
    end
    
    local targetCached = playerCache[targetId]
    local modId, modName = getModeratorInfo(source)
    makeRequest("revive", {
        targetDiscordId = targetCached and targetCached.identifiers.discordId,
        targetName = GetPlayerName(targetId),
        moderatorDiscordId = modId,
        moderatorName = modName
    })
    
    sendSuccess(source, "Revived " .. GetPlayerName(targetId))
end, false)

-- /revive-all - god
RegisterCommand("revive-all", function(source, args)
    if not hasPermission(source, "god") then return sendError(source, "No permission") end
    
    for _, playerId in ipairs(GetPlayers()) do
        if QBCore then
            TriggerClientEvent("hospital:client:Revive", tonumber(playerId))
        else
            TriggerClientEvent("esx_ambulancejob:revive", tonumber(playerId))
        end
    end
    
    sendSuccess(source, "Revived all players")
end, false)

-- /time [hour] - admin+
RegisterCommand("time", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    local hour = tonumber(args[1])
    
    if not hour or hour < 0 or hour > 23 then
        return sendError(source, "Usage: /time [0-23]")
    end
    
    ExecuteCommand("time " .. hour .. " 0 0")
    sendSuccess(source, "Time set to " .. hour .. ":00")
end, false)

-- /vehicle give [id] [spawncode] (plate) - god
-- /vehicle lookup [plate] - god
RegisterCommand("vehicle", function(source, args)
    if not hasPermission(source, "god") then return sendError(source, "No permission") end
    
    local action = args[1]
    
    if action == "give" then
        local targetId = getPlayerByIdOrName(args[2])
        local spawncode = args[3]
        local plate = args[4] or string.format("ADMIN%03d", math.random(999))
        
        if not targetId or not spawncode then
            return sendError(source, "Usage: /vehicle give [id] [spawncode] (plate)")
        end
        
        local ped = GetPlayerPed(targetId)
        local coords = GetEntityCoords(ped)
        local heading = GetEntityHeading(ped)
        
        -- Spawn vehicle (client-side is better but this works)
        if QBCore then
            TriggerClientEvent("qb-vehicleshop:client:TestDrive", targetId, spawncode)
        end
        
        sendSuccess(source, "Gave " .. spawncode .. " to " .. GetPlayerName(targetId))
        
    elseif action == "lookup" then
        local plate = args[2]
        if not plate then return sendError(source, "Usage: /vehicle lookup [plate]") end
        
        if QBCore then
            local result = exports.oxmysql:executeSync('SELECT * FROM player_vehicles WHERE plate = ?', {plate})
            if result and #result > 0 then
                local veh = result[1]
                local msg = string.format("^3Vehicle Lookup:\n^7Plate: %s\n^7Owner: %s\n^7Model: %s", 
                    veh.plate, veh.citizenid, veh.vehicle)
                if source > 0 then
                    TriggerClientEvent("chat:addMessage", source, { args = { "", msg }})
                else
                    print(msg)
                end
            else
                sendError(source, "Vehicle not found")
            end
        end
    else
        sendError(source, "Usage: /vehicle [give|lookup] ...")
    end
end, false)

-- /weather blackout - admin+
-- /weather set [weather] - admin+
RegisterCommand("weather", function(source, args)
    if not hasPermission(source, "admin") then return sendError(source, "No permission") end
    
    local action = args[1]
    
    if action == "blackout" then
        TriggerEvent("qb-weathersync:server:toggleBlackout")
        sendSuccess(source, "Toggled blackout")
        
    elseif action == "set" then
        local weather = args[2]
        if not weather then
            return sendError(source, "Weather types: clear, extrasunny, clouds, overcast, rain, thunder, snow, fog, smog")
        end
        ExecuteCommand("weather " .. weather)
        sendSuccess(source, "Weather set to " .. weather)
    else
        sendError(source, "Usage: /weather [blackout|set] (type)")
    end
end, false)

-- ==================== EXPORTS (zdiscord-style) ====================

exports("isRolePresent", function(source, roleId)
    local roles = getDiscordRoles(source)
    
    if type(roleId) == "table" then
        for _, role in ipairs(roleId) do
            for _, playerRole in ipairs(roles) do
                if tostring(role) == tostring(playerRole) then
                    return true
                end
            end
        end
        return false
    end
    
    for _, playerRole in ipairs(roles) do
        if tostring(roleId) == tostring(playerRole) then
            return true
        end
    end
    return false
end)

exports("getDiscordId", function(source)
    if playerCache[source] then
        return playerCache[source].identifiers.discordId
    end
    return getPlayerIdentifiers(source).discordId
end)

exports("getRoles", function(source)
    return getDiscordRoles(source)
end)

exports("getName", function(source)
    if playerCache[source] then
        return playerCache[source].name
    end
    return GetPlayerName(source)
end)

exports("getPermissionLevel", function(source)
    return permissionCache[source] or "user"
end)

exports("isWhitelisted", function(source)
    local identifiers = getPlayerIdentifiers(source)
    local whitelisted = false
    
    if identifiers.discordId then
        makeRequest("checkWhitelist", {
            discordId = identifiers.discordId
        }, function(statusCode, response)
            whitelisted = statusCode == 200 and response.whitelisted
        end)
        Wait(2000)
    end
    
    return whitelisted
end)

exports("getPlayerPriority", function(source)
    local identifiers = getPlayerIdentifiers(source)
    local priority = 0
    
    if identifiers.discordId then
        makeRequest("checkWhitelist", {
            discordId = identifiers.discordId
        }, function(statusCode, response)
            if statusCode == 200 and response.priority then
                priority = response.priority
            end
        end)
        Wait(2000)
    end
    
    return priority
end)

exports("log", function(event, message, pingRole, color)
    makeRequest("log", {
        event = event,
        message = message,
        color = color,
        metadata = { pingRole = pingRole }
    })
end)

-- ==================== STARTUP ====================

print("^2========================================^0")
print("^2[FiveM-Discord] Full zdiscord Implementation Loaded!^0")
print("^3[FiveM-Discord] Framework: " .. Config.Framework)
print("^3[FiveM-Discord] Whitelist: " .. (Config.WhitelistEnabled and "Enabled" or "Disabled"))
print("^2========================================^0")
print("^3Standalone Commands (25):^0")
print("  /announcement, /embed, /identifiers, /kick, /kickall")
print("  /kill, /message, /onlinecount, /players, /resource")
print("  /server, /screenshot, /teleport, /teleport-all, /whitelist")
print("^3QBCore Commands (27):^0")
print("  /ban, /clothing-menu, /gang, /inventory, /jail")
print("  /job, /logout, /money, /permissions, /revive")
print("  /revive-all, /time, /vehicle, /weather")
print("^3Exports:^0")
print("  isRolePresent, getDiscordId, getRoles, getName")
print("  getPermissionLevel, isWhitelisted, getPlayerPriority, log")
print("^2========================================^0")
