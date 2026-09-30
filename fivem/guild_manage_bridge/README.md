# Guild Manage Suite - FiveM Bridge v1.1

En lille FiveM-resource, der forbinder din server med Guild Manage Suite: dashboard, Discord `/fivem`, whitelist, bans, online spillere, serverstatus og remote staff-commands.

## 60 sekunders opsætning

1. Åbn **Dashboard → FiveM → Opsætning**.
2. Klik **Generér bridge-nøgle**.
3. Kopiér `guild_manage_bridge` til fx:
   `resources/[local]/guild_manage_bridge`
4. Kopiér den færdige `server.cfg`-blok fra dashboardet.
5. Kør i FXServer/txAdmin console:

```text
restart guild_manage_bridge
gmsbridge
```

Når `gmsbridge` viser **API test: OK**, er forbindelsen klar.

> Bridge-nøglen vises kun, når den bliver oprettet/roteret. Hvis du mister den, rotér nøglen i dashboardet og opdatér `server.cfg`.

## Minimal server.cfg

```cfg
setr gms_api_base "https://bot.nethost-solutions.dk"
setr gms_guild_id "DIT_DISCORD_GUILD_ID"
setr gms_api_key "gms_DIN_NØGLE"
setr gms_server_id "main"
setr gms_framework "auto"

ensure guild_manage_bridge
```

Det er alt de fleste servere behøver.

## Frameworks

`gms_framework "auto"` detekterer automatisk:

1. QBox (`qbx_core`)
2. QBCore (`qb-core`)
3. ESX (`es_extended`)
4. Standalone

Du kan tvinge frameworket:

```cfg
setr gms_framework "qbox"
# auto | qbox | qbcore | esx | standalone
```

QBox/QBCore giver ekstra funktioner som money, jobs, gangs og metadata. `ox_inventory` bliver automatisk brugt til inventory/våben, når resourcen er startet.

## Hvad virker automatisk?

- Heartbeat og live/offline serverstatus
- Online spillerliste, ping, position og identifiers
- Whitelist og aktive bans ved connection
- Sessions og spilletid
- Dashboard command queue
- Discord `/fivem` commands med rollebaserede permissions
- QBox/QBCore/ESX autodetection
- Remote player-actions med client ACK, så et command først bliver markeret ✅ efter klienten faktisk har udført det
- Retry/recovery af commands, hvis bridgen går ned midt i en execution
- Flere FiveM-instances under samme Discord guild via unik `gms_server_id`
- Sikre, guild-specifikke bridge-nøgler

## Flere FiveM-servere på samme Discord

Brug en unik `gms_server_id` på hver instance:

```cfg
# Server 1
setr gms_server_id "main"

# Server 2
setr gms_server_id "event"

# Server 3
setr gms_server_id "dev"
```

Queue, spillerliste, sessions og status bliver scoped pr. instance. Brug kun bogstaver, tal, `_` og `-`.

## Server-specifikke adapters

Nogle scripts har ikke en universel FiveM-standard. De kan kobles på uden at redigere bridgen:

```cfg
setr gms_event_revive "dit_ems:client:revive"
setr gms_event_jail "dit_jail:client:jail"
setr gms_event_unjail "dit_jail:client:unjail"
setr gms_event_clothing "dit_clothing:client:open"
```

Hvis en adapter mangler, fejler commanden kontrolleret med en forklaring i dashboard/Discord.

Revive har desuden en native fallback, hvis `gms_event_revive` ikke er sat.

## Avancerede indstillinger

Standardværdierne passer til de fleste servere:

| ConVar | Standard | Beskrivelse |
| --- | ---: | --- |
| `gms_api_base` | platform URL | Dashboard/API base |
| `gms_guild_id` | - | Discord server ID |
| `gms_api_key` | - | Bridge-nøgle fra dashboard |
| `gms_server_id` | `main` | Unikt instance-ID |
| `gms_framework` | `auto` | auto/qbox/qbcore/esx/standalone |
| `gms_command_poll_ms` | `1500` | Command queue poll |
| `gms_player_sync_ms` | `15000` | Spiller-sync |
| `gms_heartbeat_ms` | `30000` | Heartbeat |
| `gms_settings_refresh_ms` | `60000` | Settings refresh |
| `gms_client_action_timeout_ms` | `8000` | Ventetid på client ACK |
| `gms_api_timeout_ms` | `10000` | HTTP timeout |
| `gms_fail_open` | `false` | Tillad join ved API-fejl under whitelist/ban-check |
| `gms_debug` | `false` | Ekstra debug logs |

Bridgen clamp'er ekstremt lave intervaller, så en forkert config ikke ved et uheld hammer API'et.

## Diagnostics

Kør:

```text
gmsbridge
```

Den viser blandt andet:

- Bridge-version
- Detekteret framework
- Discord guild ID og FiveM server ID
- API URL og om nøglen er sat
- Poll/sync/heartbeat intervaller
- `ox_inventory` status
- `screenshot-basic` status
- Adapter-status
- Live API-auth test

### Typiske fejl

**HTTP 401 / Unauthorized FiveM bridge**

Bridge-nøglen matcher ikke længere. Rotér den i **FiveM → Opsætning**, erstat `gms_api_key`, og restart resourcen.

**Dashboard siger Bridge offline**

Kør `gmsbridge`. Kontrollér især API URL, guild ID, key og at outbound HTTPS er tilladt fra serveren.

**Jail/clothing fejler**

Det er ikke universelle FiveM APIs. Sæt den relevante `gms_event_...` adapter.

**Screenshot fejler**

Start/installér `screenshot-basic`.

**Money/job/gang fejler på standalone**

De funktioner kræver et understøttet framework. Standalone-commands som kick, teleport, vehicles, status og beskeder virker stadig.

## Sikkerhed

- Brug aldrig platformens `BOT_SECRET_KEY` på FiveM-serveren.
- Hver Discord guild får sin egen revokerbare bridge-nøgle.
- Kun SHA-256 hash af bridge-nøglen gemmes.
- Resource-navne valideres før resource commands.
- Bridgen kan ikke remote-stoppe eller remote-restarte sig selv.
- Commands bliver claimet atomisk før execution.
- Client-action-resultater validerer, at ACK kommer fra den spiller, commanden blev sendt til.
- Dashboard commands kræver autentificeret guild-administrator.
- Discord `/fivem` håndhæver FiveM rolle-permissions på serversiden.

## Opdatering

Ved opdatering skal du normalt kun erstatte mappen:

```text
resources/[local]/guild_manage_bridge
```

og derefter:

```text
restart guild_manage_bridge
gmsbridge
```

Bridge v1.1 rapporterer sin version til dashboardet, så det er nemt at se, om en server stadig kører en gammel bridge.
