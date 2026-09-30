local RESOURCE = GetCurrentResourceName()
local API_URL = Config.ApiBase:gsub('/+$', '') .. '/api/public/fivem-handler'
local startedAt = os.time()
local framework = 'standalone'
local cachedSettings = { enabled = false, whitelist_enabled = false, sync_playtime = true }
local processing = {}

local function log(level, message)
    print(('[%s] [%s] %s'):format(RESOURCE, level, message))
end

local function resourceStarted(name)
    return GetResourceState(name) == 'started'
end

local function detectFramework()
    if Config.Framework ~= '' and Config.Framework ~= 'auto' then
        framework = Config.Framework
    elseif resourceStarted('qbx_core') then
        framework = 'qbox'
    elseif resourceStarted('qb-core') then
        framework = 'qbcore'
    elseif resourceStarted('es_extended') then
        framework = 'esx'
    else
        framework = 'standalone'
    end
    return framework
end

local function configured()
    return Config.GuildId ~= '' and Config.ApiKey ~= '' and Config.ApiBase ~= ''
end

local function api(action, data)
    local p = promise.new()
    local body = json.encode({
        action = action,
        guildId = Config.GuildId,
        data = data or {}
    })

    PerformHttpRequest(API_URL, function(status, responseBody, headers, errorData)
        local decoded = nil
        if responseBody and responseBody ~= '' then
            local ok, result = pcall(json.decode, responseBody)
            if ok then decoded = result end
        end

        p:resolve({
            ok = status >= 200 and status < 300,
            status = status,
            data = decoded,
            body = responseBody,
            error = errorData
        })
    end, 'POST', body, {
        ['Content-Type'] = 'application/json',
        ['x-fivem-key'] = Config.ApiKey,
        ['x-gms-version'] = Config.Version,
        ['x-gms-framework'] = framework,
    })

    return Citizen.Await(p)
end

local function identifiers(source)
    local out = {
        discordId = nil,
        discordUsername = GetPlayerName(source),
        steamHex = nil,
        license = nil,
        fivemId = nil,
        ipAddress = GetPlayerEndpoint(source),
    }

    for _, identifier in ipairs(GetPlayerIdentifiers(source)) do
        if identifier:sub(1, 8) == 'discord:' then
            out.discordId = identifier:sub(9)
        elseif identifier:sub(1, 6) == 'steam:' then
            out.steamHex = identifier
        elseif identifier:sub(1, 8) == 'license:' then
            out.license = identifier
        elseif identifier:sub(1, 6) == 'fivem:' then
            out.fivemId = identifier
        end
    end

    return out
end

local function qboxPlayer(source)
    if framework ~= 'qbox' then return nil end
    local ok, player = pcall(function()
        return exports.qbx_core:GetPlayer(tonumber(source))
    end)
    return ok and player or nil
end

local function qbPlayer(source)
    if framework ~= 'qbcore' then return nil end
    local ok, core = pcall(function() return exports['qb-core']:GetCoreObject() end)
    if not ok or not core then return nil end
    return core.Functions.GetPlayer(tonumber(source))
end

local function esxPlayer(source)
    if framework ~= 'esx' then return nil end
    local ok, esx = pcall(function() return exports.es_extended:getSharedObject() end)
    if not ok or not esx then return nil end
    return esx.GetPlayerFromId(tonumber(source))
end

local function characterName(source)
    if framework == 'qbox' then
        local player = qboxPlayer(source)
        local info = player and player.PlayerData and player.PlayerData.charinfo
        if info then
            local full = ((info.firstname or '') .. ' ' .. (info.lastname or '')):gsub('^%s+', ''):gsub('%s+$', '')
            if full ~= '' then return full end
        end
    elseif framework == 'qbcore' then
        local player = qbPlayer(source)
        local info = player and player.PlayerData and player.PlayerData.charinfo
        if info then
            local full = ((info.firstname or '') .. ' ' .. (info.lastname or '')):gsub('^%s+', ''):gsub('%s+$', '')
            if full ~= '' then return full end
        end
    elseif framework == 'esx' then
        local player = esxPlayer(source)
        if player and player.getName then
            local ok, name = pcall(function() return player.getName() end)
            if ok and name and name ~= '' then return name end
        end
    end

    return GetPlayerName(source)
end

local function playerExists(source)
    source = tonumber(source)
    return source and source > 0 and GetPlayerName(source) ~= nil
end

local function moderatorSource(discordId)
    if not discordId then return nil end
    for _, source in ipairs(GetPlayers()) do
        local ids = identifiers(source)
        if ids.discordId == tostring(discordId) then
            return tonumber(source)
        end
    end
    return nil
end

local function durationSeconds(value)
    if not value or value == '' or value == 'permanent' or value == 'perm' then return nil end
    local amount, unit = tostring(value):match('^(%d+)([smhdw])$')
    amount = tonumber(amount)
    if not amount then return nil end
    local multipliers = { s = 1, m = 60, h = 3600, d = 86400, w = 604800 }
    return amount * (multipliers[unit] or 0)
end

local function presetCoords(name)
    if not name then return nil end
    return Config.Presets[tostring(name):lower()]
end

local function listResources()
    local rows = {}
    local count = GetNumResources()
    for i = 0, count - 1 do
        local name = GetResourceByFindIndex(i)
        if name then
            rows[#rows + 1] = ('%s [%s]'):format(name, GetResourceState(name))
        end
    end
    table.sort(rows)
    return table.concat(rows, '\n')
end

local function safeResourceName(name)
    return type(name) == 'string' and name:match('^[%w_%-]+$') ~= nil
end

local function clientAction(source, action, data)
    if not playerExists(source) then return false, 'Spilleren er ikke online.' end
    TriggerClientEvent('guild_manage_bridge:client:action', tonumber(source), action, data or {})
    return true, ('%s sendt til spiller %s.'):format(action, source)
end

local function inspectInventory(source)
    if resourceStarted('ox_inventory') then
        local ok, items = pcall(function()
            return exports.ox_inventory:GetInventoryItems(tonumber(source))
        end)
        if not ok then return false, tostring(items) end

        local rows = {}
        for _, item in pairs(items or {}) do
            if item and item.name and (item.count or 0) > 0 then
                rows[#rows + 1] = ('%sx %s'):format(item.count, item.name)
                if #rows >= 40 then
                    rows[#rows + 1] = '…'
                    break
                end
            end
        end
        return true, #rows > 0 and table.concat(rows, ', ') or 'Inventory er tomt.'
    end

    local player = qbPlayer(source)
    if player and player.PlayerData and player.PlayerData.items then
        local rows = {}
        for _, item in pairs(player.PlayerData.items) do
            if item and item.name and (item.amount or item.count or 0) > 0 then
                rows[#rows + 1] = ('%sx %s'):format(item.amount or item.count, item.name)
            end
        end
        return true, #rows > 0 and table.concat(rows, ', ') or 'Inventory er tomt.'
    end

    return false, 'Inventory-adapter mangler. ox_inventory anbefales.'
end

local function inventoryAction(source, action, item, count)
    source = tonumber(source)
    count = math.max(1, tonumber(count) or 1)

    if action == 'inspect' then return inspectInventory(source) end

    if resourceStarted('ox_inventory') then
        if action == 'give' then
            local ok, success, response = pcall(function()
                return exports.ox_inventory:AddItem(source, item, count)
            end)
            if not ok then return false, tostring(success) end
            return success == true, success and ('Gav %sx %s.'):format(count, item) or tostring(response)
        elseif action == 'take' then
            local ok, success, response = pcall(function()
                return exports.ox_inventory:RemoveItem(source, item, count)
            end)
            if not ok then return false, tostring(success) end
            return success == true, success and ('Fjernede %sx %s.'):format(count, item) or tostring(response)
        elseif action == 'clear' then
            local ok, err = pcall(function() exports.ox_inventory:ClearInventory(source) end)
            return ok, ok and 'Inventory ryddet.' or tostring(err)
        end
    end

    local player = qbPlayer(source)
    if player and player.Functions then
        if action == 'give' and player.Functions.AddItem then
            local success = player.Functions.AddItem(item, count)
            return success ~= false, success ~= false and ('Gav %sx %s.'):format(count, item) or 'Kunne ikke give item.'
        elseif action == 'take' and player.Functions.RemoveItem then
            local success = player.Functions.RemoveItem(item, count)
            return success ~= false, success ~= false and ('Fjernede %sx %s.'):format(count, item) or 'Kunne ikke fjerne item.'
        elseif action == 'clear' and player.Functions.ClearInventory then
            player.Functions.ClearInventory()
            return true, 'Inventory ryddet.'
        end
    end

    return false, 'Inventory-adapter mangler. Installér ox_inventory eller brug QBCore inventory.'
end

local function moneyAction(source, action, moneyType, amount)
    source = tonumber(source)
    moneyType = moneyType or 'cash'
    amount = tonumber(amount) or 0

    if framework == 'qbox' then
        if action == 'inspect' then
            local value = exports.qbx_core:GetMoney(source, moneyType)
            return value ~= false, value ~= false and ('%s: %s'):format(moneyType, value) or 'Ugyldig pengetype.'
        elseif action == 'add' then
            local ok = exports.qbx_core:AddMoney(source, moneyType, amount, 'guild-manage-suite')
            return ok == true, ok and ('Tilføjede %s %s.'):format(amount, moneyType) or 'Kunne ikke tilføje penge.'
        elseif action == 'remove' then
            local ok = exports.qbx_core:RemoveMoney(source, moneyType, amount, 'guild-manage-suite')
            return ok == true, ok and ('Fjernede %s %s.'):format(amount, moneyType) or 'Kunne ikke fjerne penge.'
        elseif action == 'set' then
            local ok = exports.qbx_core:SetMoney(source, moneyType, amount, 'guild-manage-suite')
            return ok == true, ok and ('Satte %s til %s.'):format(moneyType, amount) or 'Kunne ikke sætte penge.'
        end
    elseif framework == 'qbcore' then
        local player = qbPlayer(source)
        if not player or not player.Functions then return false, 'QBCore-spiller ikke fundet.' end
        if action == 'inspect' then
            local value = player.Functions.GetMoney and player.Functions.GetMoney(moneyType) or 0
            return true, ('%s: %s'):format(moneyType, value or 0)
        elseif action == 'add' then
            return player.Functions.AddMoney(moneyType, amount, 'guild-manage-suite') ~= false, ('Tilføjede %s %s.'):format(amount, moneyType)
        elseif action == 'remove' then
            return player.Functions.RemoveMoney(moneyType, amount, 'guild-manage-suite') ~= false, ('Fjernede %s %s.'):format(amount, moneyType)
        elseif action == 'set' and player.Functions.SetMoney then
            return player.Functions.SetMoney(moneyType, amount, 'guild-manage-suite') ~= false, ('Satte %s til %s.'):format(moneyType, amount)
        end
    elseif framework == 'esx' then
        local player = esxPlayer(source)
        if not player then return false, 'ESX-spiller ikke fundet.' end
        local account = moneyType == 'cash' and 'money' or moneyType
        if action == 'inspect' then
            local acc = player.getAccount and player.getAccount(account)
            return true, ('%s: %s'):format(account, acc and acc.money or 0)
        elseif action == 'add' then
            if account == 'money' and player.addMoney then player.addMoney(amount) else player.addAccountMoney(account, amount) end
            return true, ('Tilføjede %s %s.'):format(amount, account)
        elseif action == 'remove' then
            if account == 'money' and player.removeMoney then player.removeMoney(amount) else player.removeAccountMoney(account, amount) end
            return true, ('Fjernede %s %s.'):format(amount, account)
        elseif action == 'set' and player.setAccountMoney then
            player.setAccountMoney(account, amount)
            return true, ('Satte %s til %s.'):format(account, amount)
        end
    end

    return false, ('Money-action understøttes ikke af framework %s.'):format(framework)
end

local function jobAction(source, kind, action, name, grade)
    source = tonumber(source)
    grade = tonumber(grade) or 0

    if framework == 'qbox' then
        local player = qboxPlayer(source)
        if not player then return false, 'QBox-spiller ikke fundet.' end
        local data = player.PlayerData or {}

        if kind == 'job' then
            if action == 'inspect' then return true, json.encode(data.job or {}) end
            if action == 'fire' then
                local ok = exports.qbx_core:SetJob(source, 'unemployed', 0)
                return ok == true, ok and 'Spilleren er fyret.' or 'Kunne ikke fjerne job.'
            end
            local ok = exports.qbx_core:SetJob(source, name, grade)
            return ok == true, ok and ('Job sat til %s grade %s.'):format(name, grade) or 'Ugyldigt job/grade.'
        end

        if action == 'inspect' then return true, json.encode(data.gang or {}) end
        if action == 'remove' or action == 'kick' then
            local current = data.gang and data.gang.name
            if current and current ~= 'none' and exports.qbx_core.RemovePlayerFromGang and data.citizenid then
                local ok = exports.qbx_core:RemovePlayerFromGang(data.citizenid, current)
                return ok == true, ok and 'Spilleren er fjernet fra gang.' or 'Kunne ikke fjerne gang.'
            end
            local ok = exports.qbx_core:SetGang(source, 'none', 0)
            return ok == true, ok and 'Gang fjernet.' or 'Kunne ikke fjerne gang.'
        end
        local ok = exports.qbx_core:SetGang(source, name, grade)
        return ok == true, ok and ('Gang sat til %s grade %s.'):format(name, grade) or 'Ugyldig gang/grade.'
    elseif framework == 'qbcore' then
        local player = qbPlayer(source)
        if not player or not player.Functions then return false, 'QBCore-spiller ikke fundet.' end
        if kind == 'job' then
            if action == 'inspect' then return true, json.encode(player.PlayerData.job or {}) end
            local jobName = action == 'fire' and 'unemployed' or name
            local jobGrade = action == 'fire' and 0 or grade
            local ok = player.Functions.SetJob(jobName, jobGrade)
            return ok ~= false, ('Job sat til %s grade %s.'):format(jobName, jobGrade)
        end
        if action == 'inspect' then return true, json.encode(player.PlayerData.gang or {}) end
        local gangName = (action == 'remove' or action == 'kick') and 'none' or name
        local gangGrade = (action == 'remove' or action == 'kick') and 0 or grade
        local ok = player.Functions.SetGang(gangName, gangGrade)
        return ok ~= false, ('Gang sat til %s grade %s.'):format(gangName, gangGrade)
    elseif framework == 'esx' and kind == 'job' then
        local player = esxPlayer(source)
        if not player then return false, 'ESX-spiller ikke fundet.' end
        if action == 'inspect' then return true, json.encode(player.getJob and player.getJob() or {}) end
        local jobName = action == 'fire' and 'unemployed' or name
        local jobGrade = action == 'fire' and 0 or grade
        player.setJob(jobName, jobGrade)
        return true, ('Job sat til %s grade %s.'):format(jobName, jobGrade)
    end

    return false, ('%s understøttes ikke af framework %s.'):format(kind, framework)
end

local aliases = {
    kick = {'moderation','kick'}, kickall = {'moderation','kickall'}, ban = {'moderation','ban'},
    warn = {'moderation','warn'}, jail = {'moderation','jail'}, unjail = {'moderation','unjail'},
    freeze = {'moderation','freeze'}, unfreeze = {'moderation','unfreeze'}, spectate = {'moderation','spectate'},
    kill = {'player','kill'}, revive = {'player','revive'}, ['revive-all'] = {'player','revive-all'},
    heal = {'player','heal'}, armor = {'player','armor'}, sethealth = {'player','sethealth'},
    setarmor = {'player','setarmor'}, sethunger = {'player','sethunger'}, setthirst = {'player','setthirst'},
    setstress = {'player','setstress'}, setmodel = {'player','setmodel'}, logout = {'player','logout'},
    identifiers = {'player','identifiers'}, permissions = {'player','permissions'}, godmode = {'player','godmode'},
    invisible = {'player','invisible'}, noclip = {'player','noclip'},
    teleport = {'teleport','player'}, ['teleport-all'] = {'teleport','all'}, bring = {'teleport','bring'}, goto = {'teleport','goto'},
    vehicle = {'vehicle','spawn'}, delvehicle = {'vehicle','delete'}, repair = {'vehicle','repair'},
    giveweapon = {'weapon','give'}, ['give-weapon'] = {'weapon','give'},
    removeweapon = {'weapon','remove'}, ['remove-weapon'] = {'weapon','remove'},
    clearweapons = {'weapon','clear'}, ['clear-weapons'] = {'weapon','clear'},
    money = {'economy','money'}, inventory = {'economy','inventory'},
    job = {'jobs','job'}, gang = {'jobs','gang'}, ['clothing-menu'] = {'jobs','clothing-menu'},
    announcement = {'server','announcement'}, message = {'server','message'}, time = {'server','time'},
    weather = {'server','weather'}, resource = {'server','resource'}, screenshot = {'server','screenshot'},
    server = {'server','info'}, players = {'server','players'}, onlinecount = {'server','count'},
}

local function normalizeCommand(commandName, data)
    local group, sub = commandName:match('^([^_]+)_(.+)$')
    if group and sub then return group, sub end

    local alias = aliases[commandName]
    if alias then return alias[1], alias[2] end

    if commandName == 'whitelist' then
        local action = tostring(data.action or 'check')
        if action == 'addrole' or action == 'removerole' then
            return 'whitelist', action
        end
        return 'whitelist', action
    end

    if commandName == 'embed' then return 'server', 'embed' end
    if commandName == 'charinfo' then return 'player', 'charinfo' end
    if commandName == 'delwarn' then return 'moderation', 'delwarn' end

    return nil, nil
end

local function executeCommand(command)
    local data = command.command_data or {}
    local target = tonumber(command.target_player_id or data.targetPlayerId or data.id)
    local group, sub = normalizeCommand(command.command_name, data)
    if not group then return false, ('Ukendt command: %s'):format(command.command_name) end

    if group == 'moderation' then
        if sub == 'kick' then
            if not playerExists(target) then return false, 'Spilleren er ikke online.' end
            DropPlayer(target, data.reason or 'Kicked by staff')
            return true, ('Spiller %s kicked.'):format(target)
        elseif sub == 'kickall' then
            local count = 0
            for _, source in ipairs(GetPlayers()) do
                DropPlayer(source, data.reason or 'Server staff kick')
                count = count + 1
            end
            return true, ('Kickede %s spiller(e).'):format(count)
        elseif sub == 'ban' then
            if not playerExists(target) then return false, 'Spilleren er ikke online.' end
            local ids = identifiers(target)
            if not ids.discordId then return false, 'Spilleren har intet Discord identifier. Ban blev ikke gemt.' end
            local response = api('ban', {
                targetDiscordId = ids.discordId,
                targetName = characterName(target),
                steamHex = ids.steamHex,
                license = ids.license,
                ipAddress = ids.ipAddress,
                moderatorDiscordId = data.moderatorDiscordId,
                moderatorName = data.moderatorName,
                reason = data.reason or 'Ingen årsag',
                durationSeconds = durationSeconds(data.duration),
            })
            if not response.ok then return false, response.data and response.data.error or 'Kunne ikke gemme ban.' end
            DropPlayer(target, data.reason or 'Banned')
            return true, 'Ban gemt og spiller fjernet.'
        elseif sub == 'warn' then
            return clientAction(target, 'notify', { message = ('Advarsel: %s'):format(data.reason or 'Ingen årsag'), kind = 'warning' })
        elseif sub == 'freeze' then
            return clientAction(target, 'freeze', { state = true })
        elseif sub == 'unfreeze' then
            return clientAction(target, 'freeze', { state = false })
        elseif sub == 'spectate' then
            local modSource = moderatorSource(data.moderatorDiscordId)
            if not modSource then return false, 'Moderator skal være online i FiveM for at spectate.' end
            return clientAction(modSource, 'spectate', { target = target })
        elseif sub == 'jail' then
            if Config.Events.Jail == '' then return false, 'Jail-adapter mangler. Sæt gms_event_jail i server.cfg.' end
            TriggerClientEvent(Config.Events.Jail, target, tonumber(data.time) or 10, data.reason or '')
            return true, 'Jail-event sendt.'
        elseif sub == 'unjail' then
            if Config.Events.Unjail == '' then return false, 'Unjail-adapter mangler. Sæt gms_event_unjail i server.cfg.' end
            TriggerClientEvent(Config.Events.Unjail, target)
            return true, 'Unjail-event sendt.'
        end
    elseif group == 'player' then
        if sub == 'identifiers' then
            if not playerExists(target) then return false, 'Spilleren er ikke online.' end
            return true, json.encode(identifiers(target))
        elseif sub == 'permissions' then
            if framework == 'qbox' then
                local ok, groups = pcall(function() return exports.qbx_core:GetGroups(target) end)
                return ok, ok and json.encode(groups or {}) or tostring(groups)
            end
            return true, ('Framework: %s | ACE admin: %s'):format(framework, tostring(IsPlayerAceAllowed(tostring(target), 'command')))
        elseif sub == 'logout' then
            if framework == 'qbox' then exports.qbx_core:Logout(target); return true, 'QBox logout udført.' end
            return false, 'Remote logout er kun implementeret direkte for QBox.'
        elseif sub == 'sethunger' or sub == 'setthirst' or sub == 'setstress' then
            local metadata = sub:gsub('^set', '')
            local amount = math.max(0, math.min(100, tonumber(data.amount) or 0))
            if framework == 'qbox' then
                exports.qbx_core:SetMetadata(target, metadata, amount)
                return true, ('%s sat til %s.'):format(metadata, amount)
            end
            local player = qbPlayer(target)
            if player and player.Functions and player.Functions.SetMetaData then
                player.Functions.SetMetaData(metadata, amount)
                return true, ('%s sat til %s.'):format(metadata, amount)
            end
            return false, ('Metadata understøttes ikke af %s.'):format(framework)
        elseif sub == 'revive-all' then
            for _, source in ipairs(GetPlayers()) do TriggerClientEvent('guild_manage_bridge:client:action', tonumber(source), 'revive', {}) end
            return true, 'Revive sendt til alle spillere.'
        elseif sub == 'charinfo' then
            if framework == 'qbox' then
                local player = qboxPlayer(target)
                return player ~= nil, player and json.encode(player.PlayerData and player.PlayerData.charinfo or {}) or 'Spiller ikke fundet.'
            elseif framework == 'qbcore' then
                local player = qbPlayer(target)
                return player ~= nil, player and json.encode(player.PlayerData and player.PlayerData.charinfo or {}) or 'Spiller ikke fundet.'
            end
            return false, 'Charinfo understøttes kun direkte på QBox/QBCore.'
        end

        local actionMap = {
            kill = 'kill', revive = 'revive', heal = 'heal', armor = 'armor',
            sethealth = 'sethealth', setarmor = 'setarmor', setmodel = 'setmodel',
            godmode = 'godmode', invisible = 'invisible', noclip = 'noclip',
        }
        if actionMap[sub] then return clientAction(target, actionMap[sub], data) end
    elseif group == 'teleport' then
        if sub == 'bring' or sub == 'goto' then
            local modSource = moderatorSource(data.moderatorDiscordId)
            if not modSource then return false, 'Moderator skal være online i FiveM for bring/goto.' end
            if not playerExists(target) then return false, 'Spilleren er ikke online.' end
            local from = sub == 'bring' and modSource or target
            local to = sub == 'bring' and target or modSource
            local ped = GetPlayerPed(from)
            if ped == 0 then return false, 'Kunne ikke læse position.' end
            local coords = GetEntityCoords(ped)
            return clientAction(to, 'teleport', { x = coords.x, y = coords.y, z = coords.z, keepvehicle = true })
        end

        local coords = nil
        local coordData = type(data.coords) == 'table' and data.coords or data
        local wantsPreset = tostring(data.type or '') == 'preset' or (data.location and tostring(data.location) ~= '')
        if wantsPreset then
            coords = presetCoords(data.location)
            if not coords then return false, 'Ukendt preset-lokation.' end
        else
            local x, y, z = tonumber(coordData.x), tonumber(coordData.y), tonumber(coordData.z)
            if not x or not y or not z then return false, 'x, y og z eller et preset er påkrævet.' end
            coords = vector3(x, y, z)
        end

        if sub == 'all' then
            for _, source in ipairs(GetPlayers()) do
                TriggerClientEvent('guild_manage_bridge:client:action', tonumber(source), 'teleport', {
                    x = coords.x, y = coords.y, z = coords.z, keepvehicle = data.keepvehicle == true
                })
            end
            return true, 'Alle spillere teleporteret.'
        end

        return clientAction(target, 'teleport', {
            x = coords.x, y = coords.y, z = coords.z, keepvehicle = data.keepvehicle == true
        })
    elseif group == 'vehicle' then
        local actionMap = { spawn = 'vehicle_spawn', delete = 'vehicle_delete', repair = 'vehicle_repair' }
        if not target then target = moderatorSource(data.moderatorDiscordId) end
        if sub == 'spawn' and not data.spawncode then data.spawncode = data.vehicleCode end
        return clientAction(target, actionMap[sub], data)
    elseif group == 'weapon' then
        if resourceStarted('ox_inventory') and playerExists(target) then
            local weapon = tostring(data.weapon or ''):upper()
            if sub == 'give' then
                local ok, success, response = pcall(function()
                    return exports.ox_inventory:AddItem(target, weapon, 1, { ammo = tonumber(data.ammo) or 100 })
                end)
                if ok and success then return true, ('Gav %s via ox_inventory.'):format(weapon) end
                if ok then return false, tostring(response) end
            elseif sub == 'remove' then
                local ok, success, response = pcall(function()
                    return exports.ox_inventory:RemoveItem(target, weapon, 1)
                end)
                if ok and success then return true, ('Fjernede %s via ox_inventory.'):format(weapon) end
                if ok then return false, tostring(response) end
            elseif sub == 'clear' then
                return clientAction(target, 'weapons_clear', {})
            end
        end
        local actionMap = { give = 'weapon_give', remove = 'weapon_remove', clear = 'weapons_clear' }
        return clientAction(target, actionMap[sub], data)
    elseif group == 'economy' then
        if sub == 'money' then return moneyAction(target, data.action, data.type, data.amount) end
        if sub == 'inventory' then return inventoryAction(target, data.action, data.item, data.count) end
    elseif group == 'jobs' then
        if sub == 'job' then return jobAction(target, 'job', data.action, data.job, data.grade) end
        if sub == 'gang' then return jobAction(target, 'gang', data.action, data.gang, data.grade) end
        if sub == 'clothing-menu' then
            if Config.Events.Clothing == '' then return false, 'Clothing-adapter mangler. Sæt gms_event_clothing i server.cfg.' end
            TriggerClientEvent(Config.Events.Clothing, target)
            return true, 'Tøjmenu-event sendt.'
        end
    elseif group == 'server' then
        if sub == 'announcement' then
            TriggerClientEvent('guild_manage_bridge:client:action', -1, 'notify', { message = data.message or '', kind = 'announcement' })
            return true, 'Announcement sendt.'
        elseif sub == 'message' then
            return clientAction(target, 'notify', { message = data.message or '', kind = 'private' })
        elseif sub == 'time' then
            TriggerClientEvent('guild_manage_bridge:client:action', -1, 'time', { hour = tonumber(data.hour) or 12 })
            return true, 'Tid opdateret på klienterne.'
        elseif sub == 'weather' then
            TriggerClientEvent('guild_manage_bridge:client:action', -1, 'weather', data)
            return true, 'Vejr/blackout opdateret på klienterne.'
        elseif sub == 'resource' then
            local action = tostring(data.action or '')
            if action == 'list' then return true, listResources() end
            if action == 'refresh' then ExecuteCommand('refresh'); return true, 'Resource-listen opdateres.' end
            local name = tostring(data.name or data.resourceName or '')
            if not safeResourceName(name) then return false, 'Ugyldigt resource-navn.' end
            if action == 'inspect' then return true, ('%s: %s'):format(name, GetResourceState(name)) end
            if action == 'ensure' or action == 'start' or action == 'stop' or action == 'restart' then
                ExecuteCommand(('%s %s'):format(action, name))
                return true, ('%s %s udført.'):format(action, name)
            end
            return false, 'Ugyldig resource-action.'
        elseif sub == 'screenshot' then
            if not resourceStarted('screenshot-basic') then return false, 'screenshot-basic er ikke startet.' end
            if not playerExists(target) then return false, 'Spilleren er ikke online.' end
            local p = promise.new()
            exports['screenshot-basic']:requestClientScreenshot(target, { encoding = 'jpg', quality = 0.8 }, function(err, dataUri)
                if err then p:resolve({ false, tostring(err) }) else p:resolve({ true, dataUri }) end
            end)
            local result = Citizen.Await(p)
            if not result[1] then return false, result[2] end
            local response = api('screenshotResult', {
                targetPlayerId = target,
                targetName = characterName(target),
                targetDiscordId = identifiers(target).discordId,
                moderatorDiscordId = data.moderatorDiscordId,
                moderatorName = data.moderatorName,
                imageBase64 = result[2],
            })
            if not response.ok then
                return false, response.data and response.data.error or 'Screenshot taget, men upload/logning fejlede.'
            end
            local url = response.data and response.data.url
            return true, url and ('Screenshot: ' .. url) or 'Screenshot modtaget og logget.'
        elseif sub == 'embed' then
            local message = tostring(data.message or '')
            if data.title and tostring(data.title) ~= '' then
                message = ('%s\n%s'):format(data.title, message)
            end
            TriggerClientEvent('guild_manage_bridge:client:action', -1, 'notify', { message = message, kind = 'announcement' })
            return true, 'Beskeden er sendt til alle spillere.'
        elseif sub == 'info' then
            return true, ('%s | framework=%s | players=%s/%s | uptime=%ss'):format(
                GetConvar('sv_hostname', 'FiveM Server'), framework, #GetPlayers(), GetConvarInt('sv_maxclients', 48), os.time() - startedAt
            )
        elseif sub == 'players' then
            local rows = {}
            for _, source in ipairs(GetPlayers()) do rows[#rows + 1] = ('[%s] %s'):format(source, characterName(source)) end
            return true, #rows > 0 and table.concat(rows, '\n') or 'Ingen spillere online.'
        elseif sub == 'count' then
            return true, tostring(#GetPlayers())
        end
    elseif group == 'whitelist' then
        if sub == 'toggle' then
            local response = api('toggleWhitelist', { moderatorDiscordId = data.moderatorDiscordId })
            if response.ok and response.data then
                cachedSettings.whitelist_enabled = response.data.whitelistEnabled
                return true, ('Whitelist er nu %s.'):format(response.data.whitelistEnabled and 'TIL' or 'FRA')
            end
            return false, 'Kunne ikke toggle whitelist.'
        elseif sub == 'add' then
            local response = api('setWhitelistEntry', {
                discordId = data.discord_id or data.discordId,
                whitelisted = true,
                moderatorDiscordId = data.moderatorDiscordId,
                reason = data.reason,
            })
            return response.ok, response.ok and 'Bruger tilføjet til whitelist.' or (response.data and response.data.error or 'Whitelist add fejlede.')
        elseif sub == 'remove' then
            local response = api('removeWhitelistEntry', { discordId = data.discord_id or data.discordId })
            return response.ok, response.ok and 'Bruger fjernet fra whitelist.' or 'Whitelist remove fejlede.'
        elseif sub == 'check' then
            local response = api('getWhitelistEntry', { discordId = data.discord_id or data.discordId })
            if not response.ok then return false, 'Whitelist check fejlede.' end
            local entry = response.data and response.data.entry
            return true, entry and ('Whitelisted: %s | navn: %s'):format(tostring(entry.is_whitelisted), entry.discord_username or 'ukendt') or 'Ikke registreret.'
        end
    end

    return false, ('Command ikke implementeret: %s %s'):format(group, sub)
end

local function markCommand(commandId, success, result)
    local response = api('markCommandExecuted', {
        commandId = commandId,
        success = success == true,
        result = tostring(result or '')
    })
    if not response.ok then
        log('WARN', ('Kunne ikke rapportere resultat for command %s'):format(commandId))
    end
end

local function pollCommands()
    if not configured() then return end
    local response = api('getPendingCommands', {})
    if not response.ok then
        if response.status ~= 401 then log('WARN', ('Command poll fejlede (HTTP %s)'):format(response.status)) end
        return
    end

    for _, command in ipairs((response.data and response.data.commands) or {}) do
        if not processing[command.id] then
            processing[command.id] = true
            CreateThread(function()
                local claim = api('claimCommand', { commandId = command.id })
                if claim.ok and claim.data and claim.data.claimed then
                    local ok, success, result = pcall(executeCommand, command)
                    if not ok then
                        markCommand(command.id, false, success)
                    else
                        markCommand(command.id, success, result)
                    end
                end
                processing[command.id] = nil
            end)
        end
    end
end

local function buildPlayerList()
    local rows = {}
    for _, source in ipairs(GetPlayers()) do
        local numericSource = tonumber(source)
        local ids = identifiers(numericSource)
        local ped = GetPlayerPed(numericSource)
        local coords = ped ~= 0 and GetEntityCoords(ped) or nil

        rows[#rows + 1] = {
            playerId = numericSource,
            discordId = ids.discordId,
            discordUsername = ids.discordUsername,
            steamHex = ids.steamHex,
            license = ids.license,
            characterName = characterName(numericSource),
            ping = GetPlayerPing(numericSource),
            coords = coords and { x = coords.x, y = coords.y, z = coords.z } or nil,
        }
    end
    return rows
end

local function syncPlayers()
    if not configured() then return end
    local response = api('syncOnlinePlayers', {
        serverId = Config.ServerId,
        players = buildPlayerList(),
    })
    if not response.ok and response.status ~= 401 then
        log('WARN', ('Player sync fejlede (HTTP %s)'):format(response.status))
    end
end

local function updateStatus()
    if not configured() then return end

    local response = api('updateServerStatus', {
        serverId = Config.ServerId,
        serverName = GetConvar('sv_hostname', 'FiveM Server'),
        maxPlayers = GetConvarInt('sv_maxclients', 48),
        playerCount = #GetPlayers(),
        uptimeSeconds = os.time() - startedAt,
        serverStartedAt = os.date('!%Y-%m-%dT%H:%M:%SZ', startedAt),
        gameType = 'fivem',
        resourcesCount = GetNumResources(),
        fxserverVersion = GetConvar('version', ''),
        serverIp = GetConvar('endpoint_add_tcp', ''),
        serverPort = tonumber(GetConvar('netPort', '30120')) or 30120,
        metadata = {
            bridgeVersion = Config.Version,
            framework = framework,
            resource = RESOURCE,
        },
    })

    if not response.ok then
        log('WARN', ('Heartbeat fejlede (HTTP %s): %s'):format(response.status, response.body or ''))
    end
end

local function refreshSettings()
    if not configured() then return end
    local response = api('getSettings', {})
    if response.ok and response.data then
        cachedSettings = response.data.settings or cachedSettings
        cachedSettings.enabled = response.data.enabled ~= false
        cachedSettings.whitelist_enabled = response.data.whitelistEnabled == true
    end
end

AddEventHandler('playerConnecting', function(name, setKickReason, deferrals)
    if not configured() then return end

    local source = source
    deferrals.defer()
    Wait(0)
    deferrals.update('Kontrollerer Guild Manage Suite…')

    local ids = identifiers(source)
    local settingsResponse = api('getSettings', {})
    if settingsResponse.ok and settingsResponse.data then
        cachedSettings = settingsResponse.data.settings or cachedSettings
        cachedSettings.whitelist_enabled = settingsResponse.data.whitelistEnabled == true
    elseif not Config.FailOpen then
        deferrals.done('Kunne ikke kontakte serverens adgangssystem. Prøv igen om et øjeblik.')
        return
    end

    local banResponse = api('checkBan', {
        discordId = ids.discordId,
        steamHex = ids.steamHex,
        license = ids.license,
        ipAddress = ids.ipAddress,
    })

    if banResponse.ok and banResponse.data and banResponse.data.banned then
        local ban = banResponse.data.ban or {}
        deferrals.done(('Du er banned fra serveren.\nÅrsag: %s'):format(ban.reason or 'Ingen årsag'))
        return
    elseif not banResponse.ok and not Config.FailOpen then
        deferrals.done('Ban-kontrol kunne ikke gennemføres. Prøv igen.')
        return
    end

    if cachedSettings.whitelist_enabled then
        deferrals.update('Kontrollerer whitelist…')
        local whitelistResponse = api('checkWhitelist', {
            discordId = ids.discordId,
            steamHex = ids.steamHex,
            license = ids.license,
        })

        if not whitelistResponse.ok then
            if not Config.FailOpen then
                deferrals.done('Whitelist-kontrol kunne ikke gennemføres. Prøv igen.')
                return
            end
        elseif not whitelistResponse.data or not whitelistResponse.data.whitelisted then
            if not ids.discordId then
                deferrals.done('Discord kunne ikke registreres. Hav Discord åbent og forbundet til FiveM, og prøv igen.')
            else
                deferrals.done(('Du er ikke whitelisted. Discord ID: %s'):format(ids.discordId))
            end
            return
        end
    end

    if ids.discordId then
        api('registerPlayer', {
            discordId = ids.discordId,
            discordUsername = ids.discordUsername,
            steamHex = ids.steamHex,
            license = ids.license,
            fivemId = ids.fivemId,
            ip = ids.ipAddress,
        })
    end

    deferrals.done()
end)

AddEventHandler('playerJoining', function()
    local source = source
    if not configured() then return end
    CreateThread(function()
        Wait(1500)
        local ids = identifiers(source)
        if ids.discordId then
            api('sessionStart', {
                discordId = ids.discordId,
                serverId = Config.ServerId,
            })
        end
        syncPlayers()
    end)
end)

AddEventHandler('playerDropped', function()
    local source = source
    if not configured() then return end
    local ids = identifiers(source)

    CreateThread(function()
        if ids.discordId then
            api('sessionEnd', { discordId = ids.discordId })
        end
        api('removeOnlinePlayer', {
            playerId = tonumber(source),
            serverId = Config.ServerId,
        })
    end)
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= RESOURCE or not configured() then return end
    api('serverOffline', { serverId = Config.ServerId })
end)

CreateThread(function()
    detectFramework()

    if not configured() then
        log('ERROR', 'Ikke konfigureret. Sæt gms_guild_id og gms_api_key i server.cfg. Se dashboard → FiveM → Opsætning.')
        return
    end

    log('INFO', ('Starter v%s | framework=%s | guild=%s | server=%s'):format(
        Config.Version, framework, Config.GuildId, Config.ServerId
    ))

    refreshSettings()
    updateStatus()
    syncPlayers()

    while true do
        Wait(Config.CommandPollMs)
        pollCommands()
    end
end)

CreateThread(function()
    while true do
        Wait(Config.PlayerSyncMs)
        syncPlayers()
    end
end)

CreateThread(function()
    while true do
        Wait(Config.HeartbeatMs)
        updateStatus()
    end
end)

CreateThread(function()
    while true do
        Wait(Config.SettingsRefreshMs)
        refreshSettings()
        detectFramework()
    end
end)
