# 🤖 GuildOS Bot - VPS Deployment Guide

## Krav

- **Node.js** >= 18.x
- **npm** eller **yarn**
- **PM2** (anbefalet til produktion): `npm install -g pm2`

## Hurtig Start

### 1. Upload filer til VPS

Upload hele `bot/` mappen til din VPS, f.eks. til `/home/discord-bot/`:

```bash
scp -r bot/ user@din-vps:/home/discord-bot/
```

### 2. Kør setup

```bash
cd /home/discord-bot
bash setup.sh
```

Dette vil:
- Oprette `handlers/` mappen og flytte handler-filer derhen
- Oprette `.env` fra `.env.example`
- Installere npm dependencies

### 3. Konfigurér .env

Åbn `.env` og udfyld:

```bash
nano .env
```

| Variabel | Beskrivelse | Hvor finder du den? |
|----------|-------------|---------------------|
| `DEFAULT_BOT_TOKEN` | Din bot token | Discord Developer Portal → Bot → Token |
| `DISCORD_TOKEN` | Samme som DEFAULT_BOT_TOKEN | Discord Developer Portal → Bot → Token |
| `APPLICATION_ID` | Valgfri kontrolværdi; scriptet bruger ID'et fra det aktive bot-token | Discord Developer Portal → General Information |
| `SUPABASE_SERVICE_ROLE_KEY` | Database service key | Supabase project settings |
| `BOT_SECRET_KEY` | Delt hemmelighed | web runtime secrets |

### 4. Deploy Slash Commands

Den officielle GuildOS Bot skal bruge globale slash commands, så de er tilgængelige
på alle servere og kan registreres korrekt til Discord Discovery:

```bash
node deployCommands.js
```

Standard uden `DEPLOY_GUILD_ID` er nu global deployment.

Til en testserver eller custom bot kan guild-scoped deployment bruges eksplicit:

```bash
DEPLOY_SCOPE=guild DEPLOY_GUILD_ID=123456789012345678 node deployCommands.js
```

> ⚠️ Globale commands kan bruge lidt tid på at propagere hos Discord.

### 5. Start Bot

**Med PM2 (anbefalet):**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Autostart ved server reboot
```

**Direkte:**
```bash
node bot.js
```

## Mappestruktur

```
discord-bot/
├── bot.js                  # Hovedfil (entry point)
├── customBotManager.js     # Multi-bot manager
├── deployCommands.js       # Slash command deployment
├── music.js                # Musik modul (valgfri, kræver Lavalink)
├── package.json            # Dependencies
├── ecosystem.config.js     # PM2 config
├── .env                    # Environment variables (HEMMELIGT!)
├── handlers/               # Alle event handlers
│   ├── afkHandler.js
│   ├── aiChatHandler.js
│   ├── analyticsHandler.js
│   ├── applicationHandler.js
│   ├── autoReportHandler.js
│   ├── autoResponderHandler.js
│   ├── consoleLogger.js
│   ├── customCommandHandler.js
│   ├── globalBanHandler.js
│   ├── heartbeatHandler.js
│   ├── jtcHandler.js
│   ├── logHandler.js
│   ├── modmailHandler.js
│   ├── pollHandler.js
│   ├── reactionRoleHandler.js
│   ├── reminderHandler.js
│   ├── scheduledActionHandler.js
│   ├── schedulerHandler.js
│   ├── starboardHandler.js
│   ├── statsHandler.js
│   ├── suggestionHandler.js
│   ├── tebexHandler.js
│   ├── ticketHandler.js
│   ├── tiktokHandler.js
│   ├── twitchHandler.js
│   ├── verificationHandler.js
│   ├── warningHandler.js
│   ├── welcomeHandler.js
│   └── xpHandler.js
├── fivem/                  # FiveM integration (valgfri)
│   ├── fxmanifest.lua
│   ├── server.lua
│   └── client.lua
└── logs/                   # PM2 log filer
```

## Nyttige PM2 Kommandoer

```bash
pm2 logs discord-bot      # Se logs
pm2 restart discord-bot   # Genstart
pm2 stop discord-bot      # Stop
pm2 delete discord-bot    # Fjern fra PM2
pm2 monit                 # Real-time monitoring
```

## Musik / Lavalink

GuildOS Bot bruger Lavalink på **localhost:40191**.

Installer og start den versionerede Lavalink-konfiguration:

```bash
cd /bot
npm run lavalink:install
npm run lavalink:pm2
npm run lavalink:check
```

De relevante værdier i `.env` er:

```env
LAVALINK_HOST=localhost
LAVALINK_PORT=40191
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_NAME=Main
LAVALINK_SECURE=false

LAVALINK_RECONNECT_TRIES=120
LAVALINK_RECONNECT_INTERVAL=30
LAVALINK_REST_TIMEOUT=30
```

YouTube OAuth skal **ikke** hardcodes i `application.yml`. Hvis det skal bruges:

```env
YOUTUBE_OAUTH_ENABLED=true
YOUTUBE_REFRESH_TOKEN=NYT_REFRESH_TOKEN
```

Refresh tokens er hemmeligheder og må ikke committes til GitHub.

Lavalink-configen ligger i `lavalink/application.yml`. Botten og `npm run lavalink:check` læser begge `/bot/.env`, så porten ikke kan drive mellem bot og Lavalink.

Nyttige kommandoer:

```bash
npm run lavalink:check
npm run lavalink:restart
npm run lavalink:logs
pm2 status
ss -ltnp | grep 40191
```

## FiveM Integration (Valgfri)

Kopiér `fivem/` mappen til din FiveM servers `resources/` mappe:

```bash
cp -r fivem/ /path/to/fxserver/resources/fivem-discord-integration/
```

Tilføj til `server.cfg`:
```
ensure fivem-discord-integration
set zdiscord_api_url "https://rkdqunnttcyuybbofkvz.supabase.co/functions/v1"
set zdiscord_secret "DIN_BOT_SECRET_KEY"
set zdiscord_guild_id "DIT_GUILD_UUID"
```

## Fejlfinding

| Problem | Løsning |
|---------|---------|
| `BOT_SECRET_KEY mangler` | Tjek at .env er udfyldt korrekt |
| `401 Unauthorized` | BOT_SECRET_KEY matcher ikke Cloud secrets |
| Slash commands virker ikke | Kør `node deployCommands.js` igen |
| Bot går offline | Tjek `pm2 logs` for fejl |
| Musik virker ikke | Tjek at Lavalink kører og .env er korrekt |


## Production update på `/bot`

Production-mappen behøver ikke selv være et Git repository. Brug updater-scriptet fra bot-mappen:

```bash
cd /bot
bash update-from-github.sh --deploy-commands
```

Scriptet:
- tager backup af `/bot/.env`
- henter seneste `main`
- synkroniserer kun bot-filer og bevarer `.env`, `node_modules` og logs
- kører `npm ci --omit=dev`
- syntax-checker kritiske runtime-filer
- synkroniserer Discord commands, når `--deploy-commands` bruges
- genstarter `discord-bot` via PM2

Uden ændringer i slash-command kataloget kan `--deploy-commands` udelades.

## Discovery-safe official app

Den officielle GuildOS-app publicerer et Discovery-safe globalt command-katalog. Følgende commands er fortsat tilgængelige på custom/guild-scoped bots, men publiceres ikke på den officielle Discovery-app:

- `crime`
- `slots`
- `gamble`
- `roulette`
- `blackjack`

Runtime på den officielle bot blokerer dem også, så gamle Discord-command caches eller prefix-aliases ikke kan omgå kataloget.

Offentlige invite-links bruger et eksplicit permissionsæt i stedet for Discord `Administrator`. Eksisterende servere får ikke automatisk nye rolle-permissions ved kodeopdateringer, så manglende rettigheder som `Ban Members` skal gives til bot-rollen på den enkelte server.


## Discord Developer Portal endpoints

### Interactions Endpoint URL

Lad feltet være tomt med den nuværende GuildOS-arkitektur. Botten modtager slash commands, buttons og modals via Discord Gateway/discord.js. Discord understøtter enten Gateway-delivery eller HTTP interactions endpoint for interactions, ikke begge som parallel primary delivery.

Sæt først dette felt, hvis GuildOS bevidst migreres til en HTTP-baseret interactions-handler med Discord signature-verifikation.

### Linked Roles Verification URL

Dette felt kan bruges til en fremtidig GuildOS Linked Roles-integration. Sæt ikke en URL endnu, før route + OAuth2-flow + role connection metadata er implementeret.

En planlagt production-route kan fx være:

```text
https://bot.nethost-solutions.dk/linked-role
```

Linked Roles kræver bruger-OAuth2 med `role_connections.write` og registrering af application role connection metadata.
