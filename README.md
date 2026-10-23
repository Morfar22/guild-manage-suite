# GuildOS Bot

GuildOS Bot is an all-in-one Discord server management platform with a web dashboard and a multi-client Discord bot runtime.

## Platform

GuildOS Bot includes moderation, tickets, AutoMod, anti-raid protection, appeals, workflows, custom commands, leveling, economy, giveaways, analytics, notifications, FiveM integrations, social integrations and server administration tools.

The web application is built with React, TanStack Router, TypeScript, Tailwind CSS and Supabase. The bot runtime uses Node.js and discord.js.

## Start the complete local stack

Install Docker Engine/Desktop with Docker Compose v2, then run from a fresh clone:

```bash
docker compose up --build
```

Open [http://localhost:8080/auth](http://localhost:8080/auth), expand the email login,
and sign in with `demo@guildos.local` / `GuildOS-local-demo-2026`. The seed job creates
a **Local Demo Server**. Email signup and the dashboard's **Create Demo Server**
button also work without Discord, Twitch, or hosted Supabase accounts. The initial
image build and pull need internet access; no provider credentials or `.env` are needed.

Compose starts the TanStack dashboard, local Supabase Postgres, Auth, PostgREST,
Realtime, file Storage, an API gateway, a migration job, a seed job, and the bot's
offline process. Migration history and database/storage files persist in named
volumes. The migration job applies only migrations that have not already run.

The offline bot explicitly reports `discord_connected: false`; it does not load
the gateway bot or its background handlers. The local dashboard can edit and read
demo data. Actions that send messages, clone real servers, stream music, or call
external providers require those providers' credentials. Discord OAuth retains
the canonical production callback required by `AGENTS.md`; use email login locally.

For a real Discord application, set `DISCORD_TOKEN` in the shell or an uncommitted
root `.env`, then opt into the live bot and Lavalink:

```bash
docker compose --profile live up --build bot-live lavalink
```

The default Lavalink config enables non-YouTube sources. YouTube plugin/OAuth setup
is optional and documented by `bot/lavalink/application.yml`. Live integrations use
real provider networks. Stop the stack with `docker compose down`; to deliberately
erase local data, run `docker compose down --volumes`.

Only ports 8080 (dashboard) and 54321 (Supabase API) are published, both on loopback.
The checked-in local credentials are public fixtures. This Compose stack is for
local evaluation; use `DEPLOY_SELFHOST.md` and fresh credentials for deployment.

To check an initial container startup and the real local Auth/database boundaries:

```bash
docker compose up --build --wait --wait-timeout 300
node docker/smoke.mjs
```

The smoke script checks seeded email login, demo-guild visibility, anonymous RLS
isolation, and dashboard rendering. Docker is not available in every development
environment; a passing unit suite alone does not verify the Compose startup.

## Architecture

The application has three deployable units:

- **TanStack dashboard (`src/`)** serves React pages and the migrated server handlers
  at `/api/public/*`. Browser code uses only the public Supabase key; server routes
  use runtime secrets. The normal build targets Cloudflare through Nitro; Compose
  runs the development server so local use does not need a Cloudflare account.
- **Node bot (`bot/`)** runs discord.js clients, event handlers, scheduled work,
  and optional music integrations. It calls the dashboard through `APP_API_BASE`
  with `BOT_SECRET_KEY` and stores state in Supabase. `start-local.js` selects the
  explicit offline process; `bot.js` is the live gateway entry point.
- **Supabase Edge Functions (`supabase/functions/`)** retain the legacy Deno HTTP
  entry points. Shared runtime-neutral protocol logic lives in `src/lib/server/`
  and is imported by the corresponding route and edge entry points. Each edge
  entry keeps its platform-specific environment and transport adapter.

Supabase provides Postgres/RLS, Auth, Realtime and Storage for these units.
In Compose, `/functions/v1/*` is forwarded to the equivalent migrated dashboard
routes, so a separate legacy Deno runtime is unnecessary. A deployed legacy Edge
Function can still run independently against a configured Supabase project.

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

## Running tests offline

From a fresh clone with Node.js 22.16 or later, run:

```bash
npm ci && npm test
npm run test -- --coverage
```

Dependency installation needs registry access. Test execution needs zero external
accounts and does not require real `SUPABASE_URL` or `DISCORD_TOKEN` values.
`.env.test` supplies isolated placeholders; the test setup rejects unexpected
network access. Reusable fetch and Supabase stubs live in `tests/mocks/`.
The security regression suite runs real handlers against mocked transports and
uses an embedded Postgres engine for database-policy behavior.

Coverage reports are written to `coverage/`. The enforced gate covers the shared
security/protocol modules listed in `vitest.config.ts` (70% lines, 60% branches).
The remaining legacy handlers need broader behavioral coverage as they are changed;
the gate does not imply that the whole dashboard has reached those percentages.
Changes to `bot/handlers/*.js` and `src/routes/api/public/*.ts` must include a matching
behavioral spec under `tests/` in the same change.

To verify test execution in a clean container with networking disabled at runtime:

```bash
docker compose --profile test run --build --rm --no-deps tests
```

That command builds from the lockfile, then runs `npm test` with `network_mode: none`.

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
