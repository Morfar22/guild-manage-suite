local noclip = false
local spectating = false
local blackout = false

local function notify(message, kind)
    local prefix = kind == 'warning' and '^1ADVARSEL^7' or kind == 'announcement' and '^3SERVER^7' or '^5STAFF^7'
    TriggerEvent('chat:addMessage', {
        color = kind == 'warning' and {255, 70, 70} or {120, 170, 255},
        multiline = true,
        args = { prefix, tostring(message or '') }
    })
end

local function requestModel(model)
    local value = tostring(model or '')
    if value == '' then return nil end

    local hash = type(model) == 'number' and model or joaat(value)
    if not IsModelInCdimage(hash) or not IsModelValid(hash) then return nil end

    RequestModel(hash)
    local deadline = GetGameTimer() + 10000
    while not HasModelLoaded(hash) and GetGameTimer() < deadline do Wait(0) end
    if not HasModelLoaded(hash) then return nil end

    return hash
end

local function currentVehicle(ped)
    if IsPedInAnyVehicle(ped, false) then
        return GetVehiclePedIsIn(ped, false)
    end

    local coords = GetEntityCoords(ped)
    return GetClosestVehicle(coords.x, coords.y, coords.z, 5.0, 0, 71)
end

local function setNoclip(state)
    noclip = state
    local ped = PlayerPedId()

    SetEntityCollision(ped, not state, not state)
    FreezeEntityPosition(ped, state)
    SetEntityInvincible(ped, state)

    if state then
        CreateThread(function()
            while noclip do
                local entity = PlayerPedId()
                local pos = GetEntityCoords(entity)
                local heading = GetGameplayCamRot(2)
                local yaw = math.rad(heading.z)
                local pitch = math.rad(heading.x)
                local forward = vector3(
                    -math.sin(yaw) * math.cos(pitch),
                    math.cos(yaw) * math.cos(pitch),
                    math.sin(pitch)
                )
                local right = vector3(math.cos(yaw), math.sin(yaw), 0.0)
                local speed = IsControlPressed(0, 21) and 2.5 or 1.0

                if IsControlPressed(0, 32) then pos = pos + forward * speed end
                if IsControlPressed(0, 33) then pos = pos - forward * speed end
                if IsControlPressed(0, 34) then pos = pos - right * speed end
                if IsControlPressed(0, 35) then pos = pos + right * speed end
                if IsControlPressed(0, 22) then pos = pos + vector3(0.0, 0.0, speed) end
                if IsControlPressed(0, 36) then pos = pos - vector3(0.0, 0.0, speed) end

                SetEntityCoordsNoOffset(entity, pos.x, pos.y, pos.z, true, true, true)
                SetEntityVelocity(entity, 0.0, 0.0, 0.0)
                Wait(0)
            end
        end)
    else
        FreezeEntityPosition(ped, false)
        SetEntityCollision(ped, true, true)
        SetEntityInvincible(ped, false)
    end
end

local function executeAction(action, data)
    data = data or {}
    local ped = PlayerPedId()

    if action == 'notify' then
        notify(data.message, data.kind)
        return true, 'Besked vist.'
    end

    if action == 'kill' then
        SetEntityHealth(ped, 0)
        return true, 'Spilleren blev dræbt.'
    end

    if action == 'revive' then
        if Config.Events.Revive ~= '' then
            TriggerEvent(Config.Events.Revive)
            return true, ('Revive-event sendt: %s'):format(Config.Events.Revive)
        end

        local coords = GetEntityCoords(ped)
        NetworkResurrectLocalPlayer(coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
        ClearPedBloodDamage(ped)
        SetEntityHealth(ped, GetEntityMaxHealth(ped))
        return true, 'Spilleren blev genoplivet.'
    end

    if action == 'heal' then
        SetEntityHealth(ped, GetEntityMaxHealth(ped))
        ClearPedBloodDamage(ped)
        return true, 'Spilleren blev healet.'
    end

    if action == 'armor' then
        SetPedArmour(ped, 100)
        return true, 'Armor sat til 100.'
    end

    if action == 'sethealth' then
        local amount = math.max(0, math.min(200, tonumber(data.amount) or 200))
        SetEntityHealth(ped, amount)
        return true, ('Health sat til %s.'):format(amount)
    end

    if action == 'setarmor' then
        local amount = math.max(0, math.min(100, tonumber(data.amount) or 0))
        SetPedArmour(ped, amount)
        return true, ('Armor sat til %s.'):format(amount)
    end

    if action == 'freeze' then
        local state = data.state == true
        FreezeEntityPosition(ped, state)
        return true, state and 'Spilleren er frosset.' or 'Spilleren er frigivet.'
    end

    if action == 'godmode' then
        local nextState = not GetPlayerInvincible(PlayerId())
        SetPlayerInvincible(PlayerId(), nextState)
        SetEntityInvincible(ped, nextState)
        notify(('Godmode: %s'):format(nextState and 'TIL' or 'FRA'))
        return true, ('Godmode %s.'):format(nextState and 'aktiveret' or 'deaktiveret')
    end

    if action == 'invisible' then
        local wasVisible = IsEntityVisible(ped)
        SetEntityVisible(ped, not wasVisible, false)
        notify(('Usynlig: %s'):format(wasVisible and 'TIL' or 'FRA'))
        return true, ('Usynlighed %s.'):format(wasVisible and 'aktiveret' or 'deaktiveret')
    end

    if action == 'noclip' then
        setNoclip(not noclip)
        notify(('Noclip: %s'):format(noclip and 'TIL' or 'FRA'))
        return true, ('Noclip %s.'):format(noclip and 'aktiveret' or 'deaktiveret')
    end

    if action == 'setmodel' then
        local hash = requestModel(data.model)
        if not hash then
            notify('Ugyldigt ped model.', 'warning')
            return false, 'Ugyldigt ped model eller modellen kunne ikke loades.'
        end

        SetPlayerModel(PlayerId(), hash)
        SetModelAsNoLongerNeeded(hash)
        return true, ('Ped model sat til %s.'):format(tostring(data.model))
    end

    if action == 'teleport' then
        local x, y, z = tonumber(data.x), tonumber(data.y), tonumber(data.z)
        if not x or not y or not z then
            return false, 'Ugyldige koordinater.'
        end

        local entity = ped
        if data.keepvehicle == true and IsPedInAnyVehicle(ped, false) then
            entity = GetVehiclePedIsIn(ped, false)
        end

        SetEntityCoords(entity, x, y, z, false, false, false, false)
        return true, ('Teleporteret til %.2f, %.2f, %.2f.'):format(x, y, z)
    end

    if action == 'spectate' then
        local targetPlayer = GetPlayerFromServerId(tonumber(data.target) or -1)
        if targetPlayer == -1 then
            notify('Target kunne ikke findes.', 'warning')
            return false, 'Target kunne ikke findes på klienten.'
        end

        spectating = not spectating
        NetworkSetInSpectatorMode(spectating, GetPlayerPed(targetPlayer))
        notify(('Spectate: %s'):format(spectating and 'TIL' or 'FRA'))
        return true, ('Spectate %s.'):format(spectating and 'aktiveret' or 'deaktiveret')
    end

    if action == 'vehicle_spawn' then
        local hash = requestModel(data.spawncode)
        if not hash or not IsModelAVehicle(hash) then
            if hash then SetModelAsNoLongerNeeded(hash) end
            notify('Ugyldig vehicle spawncode.', 'warning')
            return false, 'Ugyldig vehicle spawncode eller modellen kunne ikke loades.'
        end

        local coords = GetEntityCoords(ped)
        local vehicle = CreateVehicle(hash, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
        if vehicle == 0 then
            SetModelAsNoLongerNeeded(hash)
            return false, 'FiveM kunne ikke oprette køretøjet.'
        end

        if data.plate and tostring(data.plate) ~= '' then
            SetVehicleNumberPlateText(vehicle, tostring(data.plate):sub(1, 8))
        end

        SetPedIntoVehicle(ped, vehicle, -1)
        SetModelAsNoLongerNeeded(hash)
        return true, ('Køretøj %s spawned.'):format(tostring(data.spawncode))
    end

    if action == 'vehicle_delete' then
        local vehicle = currentVehicle(ped)
        if not vehicle or vehicle == 0 or not DoesEntityExist(vehicle) then
            return false, 'Intet køretøj fundet inden for 5 meter.'
        end

        SetEntityAsMissionEntity(vehicle, true, true)
        DeleteVehicle(vehicle)
        return not DoesEntityExist(vehicle), DoesEntityExist(vehicle) and 'Køretøjet kunne ikke slettes.' or 'Køretøjet blev slettet.'
    end

    if action == 'vehicle_repair' then
        local vehicle = currentVehicle(ped)
        if not vehicle or vehicle == 0 or not DoesEntityExist(vehicle) then
            return false, 'Intet køretøj fundet inden for 5 meter.'
        end

        SetVehicleFixed(vehicle)
        SetVehicleDeformationFixed(vehicle)
        SetVehicleDirtLevel(vehicle, 0.0)
        SetVehicleEngineHealth(vehicle, 1000.0)
        SetVehicleBodyHealth(vehicle, 1000.0)
        return true, 'Køretøjet blev repareret.'
    end

    if action == 'weapon_give' then
        local weaponName = tostring(data.weapon or '')
        if weaponName == '' then return false, 'Våbenkode mangler.' end

        local weapon = joaat(weaponName)
        GiveWeaponToPed(ped, weapon, math.max(0, tonumber(data.ammo) or 100), false, true)
        return true, ('Våben %s givet.'):format(weaponName)
    end

    if action == 'weapon_remove' then
        local weaponName = tostring(data.weapon or '')
        if weaponName == '' then return false, 'Våbenkode mangler.' end

        RemoveWeaponFromPed(ped, joaat(weaponName))
        return true, ('Våben %s fjernet.'):format(weaponName)
    end

    if action == 'weapons_clear' then
        RemoveAllPedWeapons(ped, true)
        return true, 'Alle våben blev fjernet.'
    end

    if action == 'time' then
        local hour = math.max(0, math.min(23, tonumber(data.hour) or 12))
        NetworkOverrideClockTime(hour, 0, 0)
        return true, ('Klokkeslæt sat til %02d:00.'):format(hour)
    end

    if action == 'weather' then
        if tostring(data.action or '') == 'blackout' then
            blackout = not blackout
            SetArtificialLightsState(blackout)
            return true, ('Blackout %s.'):format(blackout and 'aktiveret' or 'deaktiveret')
        end

        local weather = tostring(data.weather or 'CLEAR'):upper()
        SetWeatherTypeOvertimePersist(weather, 3.0)
        Wait(3000)
        SetWeatherTypeNowPersist(weather)
        SetWeatherTypeNow(weather)
        return true, ('Vejr sat til %s.'):format(weather)
    end

    return false, ('Ukendt client action: %s'):format(tostring(action))
end

RegisterNetEvent('guild_manage_bridge:client:action', function(action, data, requestId)
    local ok, success, message = pcall(executeAction, action, data or {})
    if not ok then
        message = tostring(success)
        success = false
    end

    if requestId then
        TriggerServerEvent(
            'guild_manage_bridge:server:actionResult',
            requestId,
            success == true,
            tostring(message or '')
        )
    end
end)
