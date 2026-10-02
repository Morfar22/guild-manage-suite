# GuildOS Bot

GuildOS Bot is an all-in-one Discord server management platform with a web dashboard and a multi-client Discord bot runtime.

## Platform

GuildOS Bot includes moderation, tickets, AutoMod, anti-raid protection, appeals, workflows, custom commands, leveling, economy, giveaways, analytics, notifications, FiveM integrations, social integrations and server administration tools.

The web application is built with React, TanStack Router, TypeScript, Tailwind CSS and Supabase. The bot runtime uses Node.js and discord.js.

## Development

```bash
npm install
npm run dev
```

Build the dashboard with:

```bash
npm run build
```

Validate the canonical Discord command catalog with:

```bash
npm run check:commands
```

## Bot runtime

The bot lives in `bot/`.

```bash
cd bot
npm install
node --check bot.js
node bot.js
```

For PM2 deployments, the existing process identifier remains `discord-bot` for backwards compatibility. The visible product and default Discord bot name are **GuildOS Bot**.

## Configuration

Runtime secrets and infrastructure identifiers intentionally keep their existing names, including Discord/Supabase environment variables and API hostnames. They are implementation details and are not part of the public brand.

## Brand

**Product:** GuildOS Bot  
**Dashboard:** GuildOS Bot  
**Default Discord bot:** GuildOS Bot  
**Operations workspace:** GuildOS Bot Operations Center
