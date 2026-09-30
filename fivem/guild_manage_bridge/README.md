# Guild Manage Suite - FiveM Bridge

Denne resource forbinder en FiveM-server sikkert med Guild Manage Suite.

## Hurtig opsætning

1. Åbn **Dashboard → FiveM → Opsætning**.
2. Opret/rotér en bridge-nøgle.
3. Kopiér mappen `guild_manage_bridge` til din servers `resources`-mappe.
4. Indsæt snippet'et fra dashboardet i `server.cfg`.
5. Genstart resourcen/serveren.
6. Dashboardet viser **Forbundet**, når første heartbeat er modtaget.

Eksempel:

```cfg
setr gms_api_base "https://bot.nethost-solutions.dk"
setr gms_guild_id "DIT_DISCORD_GUILD_ID"
setr gms_api_key "gms_DIN_NØGLE"
setr gms_server_id "main"
setr gms_framework "auto"

ensure guild_manage_bridge
```

## Frameworks

`gms_framework "auto"` forsøger i denne rækkefølge:

1. QBox (`qbx_core`)
2. QBCore (`qb-core`)
3. ESX (`es_extended`)
4. Standalone

QBox er førsteborger i integrationen og understøtter bl.a. money, job, gang og metadata direkte. `ox_inventory` detekteres automatisk til inventory-kommandoer.

Du kan tvinge framework:

```cfg
setr gms_framework "qbox"
# qbox | qbcore | esx | standalone
```

## Server-specifikke adapters

Jail og clothing varierer fra server til server. De kan kobles på uden at redigere bridgen:

```cfg
setr gms_event_jail "dit_jail:client:jail"
setr gms_event_unjail "dit_jail:client:unjail"
setr gms_event_clothing "dit_clothing:client:open"
setr gms_event_revive "dit_ems:client:revive"
```

Hvis en adapter mangler, fejler commanden kontrolleret med en forklaring i Discord/dashboard i stedet for at gøre ingenting.

## Sikkerhed

- Brug **aldrig** platformens `BOT_SECRET_KEY` i FiveM.
- Dashboardet genererer en separat, revokerbar nøgle pr. Discord-server.
- Kun SHA-256 hash af nøglen gemmes i databasen.
- Resource-navne valideres før `start/stop/restart/ensure`, så command injection blokeres.
- Discord `/fivem` håndhæver mod/admin/god-niveau på serversiden.
- Queue-items bliver claimet før execution, så to bridges ikke udfører samme command samtidigt.

## ConVars

| ConVar | Standard | Beskrivelse |
| --- | --- | --- |
| `gms_api_base` | `https://bot.nethost-solutions.dk` | Dashboard/API base URL |
| `gms_guild_id` | tom | Discord server ID |
| `gms_api_key` | tom | Bridge key fra dashboard |
| `gms_server_id` | `main` | ID hvis samme Discord-server har flere FiveM instances |
| `gms_framework` | `auto` | auto/qbox/qbcore/esx/standalone |
| `gms_command_poll_ms` | `1500` | Queue polling |
| `gms_player_sync_ms` | `15000` | Online player sync |
| `gms_heartbeat_ms` | `30000` | Server heartbeat |
| `gms_settings_refresh_ms` | `60000` | Settings refresh |
| `gms_fail_open` | `false` | Tillad join hvis API er nede under whitelist-check |

## Integrationsstatus

Bridgen sender automatisk:
- heartbeat/serverstatus
- online spillere
- identifiers
- session start/slut
- spilletid
- framework/version
- command-resultater

Den henter automatisk:
- command queue
- whitelist
- bans
- FiveM-indstillinger

## Fejlsøgning

Ved korrekt startup ses fx:

```text
[guild_manage_bridge] [INFO] Starter v1.0.0 | framework=qbox | guild=...
```

Hvis du ser:

```text
Ikke konfigureret. Sæt gms_guild_id og gms_api_key...
```

mangler `server.cfg` værdierne.

HTTP 401 betyder normalt forkert/roteret bridge key. Generér en ny under **FiveM → Opsætning**.
