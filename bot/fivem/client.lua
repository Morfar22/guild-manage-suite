--[[
    FiveM Client Script for zdiscord Dashboard Commands
    Handles client-side events triggered from the server
]]

-- Kill player (server triggers this event)
RegisterNetEvent("zdiscord:kill", function()
    local ped = PlayerPedId()
    SetEntityHealth(ped, 0)
end)

-- Revive player (basic standalone)
RegisterNetEvent("zdiscord:revive", function()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    
    -- Respawn the player
    NetworkResurrectLocalPlayer(coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
    SetEntityHealth(ped, 200)
    ClearPedBloodDamage(ped)
    
    -- Clear any ragdoll state
    SetPedToRagdoll(ped, 0, 0, 0, false, false, false)
end)

-- Heal player
RegisterNetEvent("zdiscord:heal", function()
    local ped = PlayerPedId()
    SetEntityHealth(ped, 200)
    ClearPedBloodDamage(ped)
    print("[zdiscord] Player healed")
end)

-- Set player health
RegisterNetEvent("zdiscord:setHealth", function(amount)
    local ped = PlayerPedId()
    SetEntityHealth(ped, tonumber(amount) or 200)
    print("[zdiscord] Health set to: " .. tostring(amount))
end)

-- Set player armor
RegisterNetEvent("zdiscord:setArmor", function(amount)
    local ped = PlayerPedId()
    SetPedArmour(ped, tonumber(amount) or 100)
    print("[zdiscord] Armor set to: " .. tostring(amount))
end)

-- Give weapon to player
RegisterNetEvent("zdiscord:giveWeapon", function(weaponName, ammoCount)
    local ped = PlayerPedId()
    local weaponHash = GetHashKey(weaponName)
    
    -- Make sure weapon is loaded
    RequestWeaponAsset(weaponHash, 31, false)
    while not HasWeaponAssetLoaded(weaponHash) do
        Wait(10)
    end
    
    GiveWeaponToPed(ped, weaponHash, ammoCount or 100, false, true)
    print("[zdiscord] Received weapon: " .. weaponName .. " with " .. tostring(ammoCount) .. " ammo")
end)

-- Remove weapon from player
RegisterNetEvent("zdiscord:removeWeapon", function(weaponName)
    local ped = PlayerPedId()
    local weaponHash = GetHashKey(weaponName)
    RemoveWeaponFromPed(ped, weaponHash)
    print("[zdiscord] Removed weapon: " .. weaponName)
end)

-- Clear all weapons
RegisterNetEvent("zdiscord:clearWeapons", function()
    RemoveAllPedWeapons(PlayerPedId(), true)
    print("[zdiscord] All weapons cleared")
end)

-- Teleport player (with optional vehicle support)
RegisterNetEvent("zdiscord:teleport", function(x, y, z, keepVehicle)
    local ped = PlayerPedId()
    if keepVehicle and IsPedInAnyVehicle(ped, false) then
        local vehicle = GetVehiclePedIsIn(ped, false)
        SetEntityCoords(vehicle, x, y, z, false, false, false, false)
    else
        SetEntityCoords(ped, x, y, z, false, false, false, false)
    end
    print("[zdiscord] Teleported to: " .. x .. ", " .. y .. ", " .. z)
end)

-- Godmode toggle
local godmodeEnabled = false
RegisterNetEvent("zdiscord:godmode", function(enable)
    godmodeEnabled = not godmodeEnabled
    local ped = PlayerPedId()
    SetEntityInvincible(ped, godmodeEnabled)
    print("[zdiscord] Godmode " .. (godmodeEnabled and "enabled" or "disabled"))
end)

-- Invisibility toggle
local invisibleEnabled = false
RegisterNetEvent("zdiscord:invisible", function()
    invisibleEnabled = not invisibleEnabled
    local ped = PlayerPedId()
    SetEntityVisible(ped, not invisibleEnabled, false)
    print("[zdiscord] Invisibility " .. (invisibleEnabled and "enabled" or "disabled"))
end)

-- Repair vehicle
RegisterNetEvent("zdiscord:repairVehicle", function()
    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, false) then
        local vehicle = GetVehiclePedIsIn(ped, false)
        SetVehicleFixed(vehicle)
        SetVehicleDeformationFixed(vehicle)
        SetVehicleUndriveable(vehicle, false)
        SetVehicleEngineOn(vehicle, true, true)
        print("[zdiscord] Vehicle repaired")
    else
        print("[zdiscord] Not in a vehicle")
    end
end)

-- Delete vehicle
RegisterNetEvent("zdiscord:deleteVehicle", function()
    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, false) then
        local vehicle = GetVehiclePedIsIn(ped, false)
        DeleteEntity(vehicle)
        print("[zdiscord] Vehicle deleted")
    else
        -- Try to delete closest vehicle
        local coords = GetEntityCoords(ped)
        local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 10.0, 0, 71)
        if DoesEntityExist(vehicle) then
            DeleteEntity(vehicle)
            print("[zdiscord] Closest vehicle deleted")
        else
            print("[zdiscord] No vehicle found")
        end
    end
end)

-- Spawn vehicle
RegisterNetEvent("zdiscord:spawnVehicle", function(model, plate)
    local hash = GetHashKey(model)
    RequestModel(hash)
    local timeout = 0
    while not HasModelLoaded(hash) and timeout < 100 do
        Wait(10)
        timeout = timeout + 1
    end
    if HasModelLoaded(hash) then
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        local heading = GetEntityHeading(ped)
        local vehicle = CreateVehicle(hash, coords.x, coords.y, coords.z, heading, true, false)
        TaskWarpPedIntoVehicle(ped, vehicle, -1)
        if plate then
            SetVehicleNumberPlateText(vehicle, plate)
        end
        SetModelAsNoLongerNeeded(hash)
        print("[zdiscord] Spawned vehicle: " .. model)
    else
        print("[zdiscord] Failed to load model: " .. model)
    end
end)

-- Set ped model
RegisterNetEvent("zdiscord:setModel", function(model)
    local hash = GetHashKey(model)
    RequestModel(hash)
    local timeout = 0
    while not HasModelLoaded(hash) and timeout < 100 do
        Wait(10)
        timeout = timeout + 1
    end
    if HasModelLoaded(hash) then
        SetPlayerModel(PlayerId(), hash)
        SetModelAsNoLongerNeeded(hash)
        print("[zdiscord] Model set to: " .. model)
    else
        print("[zdiscord] Failed to load model: " .. model)
    end
end)

-- Freeze player
RegisterNetEvent("zdiscord:freeze", function(freeze)
    local ped = PlayerPedId()
    FreezeEntityPosition(ped, freeze)
    print("[zdiscord] Player frozen: " .. tostring(freeze))
end)

-- Toggle noclip
local noclipEnabled = false
local noclipThread = nil

RegisterNetEvent("zdiscord:noclip", function()
    noclipEnabled = not noclipEnabled
    local ped = PlayerPedId()
    
    if noclipEnabled then
        SetEntityVisible(ped, false, false)
        SetEntityCollision(ped, false, false)
        FreezeEntityPosition(ped, true)
        SetEntityInvincible(ped, true)
        
        if not noclipThread then
            noclipThread = CreateThread(function()
                while noclipEnabled do
                    local camRot = GetGameplayCamRot(0)
                    local camCoord = GetGameplayCamCoord()
                    local speed = 1.0
                    
                    if IsControlPressed(0, 21) then -- Shift = fast
                        speed = 3.0
                    end
                    if IsControlPressed(0, 36) then -- Ctrl = slow
                        speed = 0.3
                    end
                    
                    local newPos = GetEntityCoords(ped)
                    
                    if IsControlPressed(0, 32) then -- W
                        newPos = newPos + GetCamDirection() * speed
                    end
                    if IsControlPressed(0, 33) then -- S
                        newPos = newPos - GetCamDirection() * speed
                    end
                    if IsControlPressed(0, 34) then -- A
                        local heading = GetEntityHeading(ped)
                        newPos = vector3(
                            newPos.x + speed * math.cos(math.rad(heading + 90)),
                            newPos.y + speed * math.sin(math.rad(heading + 90)),
                            newPos.z
                        )
                    end
                    if IsControlPressed(0, 35) then -- D
                        local heading = GetEntityHeading(ped)
                        newPos = vector3(
                            newPos.x + speed * math.cos(math.rad(heading - 90)),
                            newPos.y + speed * math.sin(math.rad(heading - 90)),
                            newPos.z
                        )
                    end
                    if IsControlPressed(0, 44) then -- Q = up
                        newPos = vector3(newPos.x, newPos.y, newPos.z + speed)
                    end
                    if IsControlPressed(0, 20) then -- Z = down
                        newPos = vector3(newPos.x, newPos.y, newPos.z - speed)
                    end
                    
                    SetEntityCoords(ped, newPos.x, newPos.y, newPos.z, false, false, false, false)
                    SetEntityHeading(ped, GetGameplayCamRelativeHeading() + GetEntityHeading(ped))
                    
                    Wait(0)
                end
                noclipThread = nil
            end)
        end
        
        print("[zdiscord] Noclip enabled")
    else
        SetEntityVisible(ped, true, false)
        SetEntityCollision(ped, true, true)
        FreezeEntityPosition(ped, false)
        SetEntityInvincible(ped, false)
        print("[zdiscord] Noclip disabled")
    end
end)

-- Helper function to get camera direction
function GetCamDirection()
    local heading = GetGameplayCamRelativeHeading() + GetEntityHeading(PlayerPedId())
    local pitch = GetGameplayCamRelativePitch()
    
    local x = -math.sin(math.rad(heading)) * math.abs(math.cos(math.rad(pitch)))
    local y = math.cos(math.rad(heading)) * math.abs(math.cos(math.rad(pitch)))
    local z = math.sin(math.rad(pitch))
    
    return vector3(x, y, z)
end

-- Spectate player
local spectating = false
local spectateTarget = nil

RegisterNetEvent("zdiscord:spectate", function(targetServerId)
    spectating = not spectating
    
    if spectating and targetServerId then
        spectateTarget = GetPlayerFromServerId(targetServerId)
        if spectateTarget and spectateTarget ~= -1 then
            local targetPed = GetPlayerPed(spectateTarget)
            if targetPed and DoesEntityExist(targetPed) then
                local coords = GetEntityCoords(targetPed)
                SetEntityCoords(PlayerPedId(), coords.x, coords.y, coords.z + 5.0, false, false, false, false)
                NetworkSetInSpectatorMode(true, targetPed)
                print("[zdiscord] Now spectating player " .. targetServerId)
            end
        end
    else
        NetworkSetInSpectatorMode(false, PlayerPedId())
        spectating = false
        spectateTarget = nil
        print("[zdiscord] Stopped spectating")
    end
end)

print("^2[zdiscord] Client script loaded^0")
