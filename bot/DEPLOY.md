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
| `APPLICATION_ID` | Bot application ID | Discord Developer Portal → General Information |
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
