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
    local hash = type(model) == 'number' and model or joaat(tostring(model))
    if not IsModelInCdimage(hash) or not IsModelValid(hash) then return nil end
    RequestModel(hash)
    local deadline = GetGameTimer() + 10000
    while not HasModelLoaded(hash) and GetGameTimer() < deadline do Wait(0) end
    if not HasModelLoaded(hash) then return nil end
    return hash
end

local function currentVehicle(ped)
    if IsPedInAnyVehicle(ped, false) then return GetVehiclePedIsIn(ped, false) end
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
                local forward = vector3(-math.sin(yaw) * math.cos(pitch), math.cos(yaw) * math.cos(pitch), math.sin(pitch))
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

RegisterNetEvent('guild_manage_bridge:client:action', function(action, data)
    data = data or {}
    local ped = PlayerPedId()

    if action == 'notify' then
        notify(data.message, data.kind)
        return
    end

    if action == 'kill' then
        SetEntityHealth(ped, 0)
        return
    end

    if action == 'revive' then
        if Config.Events.Revive ~= '' then
            TriggerEvent(Config.Events.Revive)
            return
        end
        local coords = GetEntityCoords(ped)
        NetworkResurrectLocalPlayer(coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
        ClearPedBloodDamage(ped)
        SetEntityHealth(ped, GetEntityMaxHealth(ped))
        return
    end

    if action == 'heal' then
        SetEntityHealth(ped, GetEntityMaxHealth(ped))
        ClearPedBloodDamage(ped)
        return
    end

    if action == 'armor' then
        SetPedArmour(ped, 100)
        return
    end

    if action == 'sethealth' then
        SetEntityHealth(ped, math.max(0, math.min(200, tonumber(data.amount) or 200)))
        return
    end

    if action == 'setarmor' then
        SetPedArmour(ped, math.max(0, math.min(100, tonumber(data.amount) or 0)))
        return
    end

    if action == 'freeze' then
        FreezeEntityPosition(ped, data.state == true)
        return
    end

    if action == 'godmode' then
        local nextState = not GetPlayerInvincible(PlayerId())
        SetPlayerInvincible(PlayerId(), nextState)
        SetEntityInvincible(ped, nextState)
        notify(('Godmode: %s'):format(nextState and 'TIL' or 'FRA'))
        return
    end

    if action == 'invisible' then
        local nextState = IsEntityVisible(ped)
        SetEntityVisible(ped, not nextState, false)
        notify(('Usynlig: %s'):format(nextState and 'TIL' or 'FRA'))
        return
    end

    if action == 'noclip' then
        setNoclip(not noclip)
        notify(('Noclip: %s'):format(noclip and 'TIL' or 'FRA'))
        return
    end

    if action == 'setmodel' then
        local hash = requestModel(data.model)
        if not hash then
            notify('Ugyldigt ped model.', 'warning')
            return
        end
        SetPlayerModel(PlayerId(), hash)
        SetModelAsNoLongerNeeded(hash)
        return
    end

    if action == 'teleport' then
        local x, y, z = tonumber(data.x), tonumber(data.y), tonumber(data.z)
        if not x or not y or not z then return end
        local entity = ped
        if data.keepvehicle == true and IsPedInAnyVehicle(ped, false) then
            entity = GetVehiclePedIsIn(ped, false)
        end
        SetEntityCoords(entity, x, y, z, false, false, false, false)
        return
    end

    if action == 'spectate' then
        local targetPlayer = GetPlayerFromServerId(tonumber(data.target) or -1)
        if targetPlayer == -1 then
            notify('Target kunne ikke findes.', 'warning')
            return
        end
        spectating = not spectating
        NetworkSetInSpectatorMode(spectating, GetPlayerPed(targetPlayer))
        notify(('Spectate: %s'):format(spectating and 'TIL' or 'FRA'))
        return
    end

    if action == 'vehicle_spawn' then
        local hash = requestModel(data.spawncode)
        if not hash or not IsModelAVehicle(hash) then
            notify('Ugyldig vehicle spawncode.', 'warning')
            return
        end
        local coords = GetEntityCoords(ped)
        local vehicle = CreateVehicle(hash, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
        if data.plate and tostring(data.plate) ~= '' then
            SetVehicleNumberPlateText(vehicle, tostring(data.plate):sub(1, 8))
        end
        SetPedIntoVehicle(ped, vehicle, -1)
        SetModelAsNoLongerNeeded(hash)
        return
    end

    if action == 'vehicle_delete' then
        local vehicle = currentVehicle(ped)
        if vehicle and vehicle ~= 0 then
            SetEntityAsMissionEntity(vehicle, true, true)
            DeleteVehicle(vehicle)
        end
        return
    end

    if action == 'vehicle_repair' then
        local vehicle = currentVehicle(ped)
        if vehicle and vehicle ~= 0 then
            SetVehicleFixed(vehicle)
            SetVehicleDeformationFixed(vehicle)
            SetVehicleDirtLevel(vehicle, 0.0)
            SetVehicleEngineHealth(vehicle, 1000.0)
            SetVehicleBodyHealth(vehicle, 1000.0)
        end
        return
    end

    if action == 'weapon_give' then
        local weapon = joaat(tostring(data.weapon or 'WEAPON_PISTOL'))
        GiveWeaponToPed(ped, weapon, tonumber(data.ammo) or 100, false, true)
        return
    end

    if action == 'weapon_remove' then
        RemoveWeaponFromPed(ped, joaat(tostring(data.weapon or '')))
        return
    end

    if action == 'weapons_clear' then
        RemoveAllPedWeapons(ped, true)
        return
    end

    if action == 'time' then
        local hour = math.max(0, math.min(23, tonumber(data.hour) or 12))
        NetworkOverrideClockTime(hour, 0, 0)
        return
    end

    if action == 'weather' then
        if tostring(data.action or '') == 'blackout' then
            blackout = not blackout
            SetArtificialLightsState(blackout)
            return
        end

        local weather = tostring(data.weather or 'CLEAR')
        SetWeatherTypeOvertimePersist(weather, 3.0)
        Wait(3000)
        SetWeatherTypeNowPersist(weather)
        SetWeatherTypeNow(weather)
        return
    end
end)
