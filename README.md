# GuildOS Bot

GuildOS Bot is an all-in-one Discord server management platform with a web dashboard and a multi-client Discord bot runtime.

## Platform

GuildOS Bot includes moderation, tickets, AutoMod, anti-raid protection, appeals, workflows, custom commands, leveling, economy, giveaways, analytics, notifications, FiveM integrations, social integrations and server administration tools.

The web application is built with React, TanStack Router, TypeScript, Tailwind CSS and Supabase. The bot runtime uses Node.js and discord.js.

## Development

```bash
npm ci
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

## Validation

Use Node.js 22.16 or later (Node.js 24 in CI). `package-lock.json` is the
authoritative dependency lockfile; install with npm so CI and local builds use
the same dependency versions.

```bash
npm test
npm run typecheck
npm run build
```

Security regression tests exercise the real dashboard and legacy Edge Function
handlers with mocked database and network boundaries. They do not call production.
See `DEPLOY_SELFHOST.md` for the coordinated rollout and token migration procedure.

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

## Security

Never commit runtime `.env` files, Discord bot tokens, Supabase service-role keys or
`BOT_SECRET_KEY`. Use the committed `.env.example` templates and provide real values
through the deployment environment.

If a credential has ever been committed to Git history, rotate it at the provider even
after deleting the file from the current branch.

## Discord Discovery

The official GuildOS Bot application uses global slash commands. The production bot
checks the running application against Discord application `1555371176224628787` and
warns on mismatch.

Public legal pages:

- Terms of Service: `https://bot.nethost-solutions.dk/terms`
- Privacy Policy: `https://bot.nethost-solutions.dk/privacy`

Run the canonical command deployment with:

```bash
cd bot
node deployCommands.js
```

Use `DEPLOY_SCOPE=guild` only for test or custom-bot deployments.
