# GuildOS Cloudflare → VPS channel bridge

The dashboard runs on Cloudflare; the Discord bot and bridge stay on your VPS. The Cloudflare server route validates the logged-in user and their guild access with Supabase, then calls the VPS bridge with a private shared secret. The browser never receives the shared secret or Discord bot token.

## 1. VPS

Pull the repository on the VPS and install the bot dependencies.

```sh
cd /bot
git pull origin main   # Only if /bot is a Git repository. Otherwise deploy updated bot files.
npm install
openssl rand -hex 32
```

Store the generated 64-character random string privately. Use the *same* string on the VPS and Cloudflare. Do not paste it into GitHub or chat.

Add to the VPS bot environment (`/bot/.env`):

```dotenv
GUILDOS_BRIDGE_SECRET=<generated-random-value>
GUILDOS_BRIDGE_HOST=127.0.0.1
GUILDOS_BRIDGE_PORT=3187
# Existing DEFAULT_BOT_TOKEN, DISCORD_TOKEN or DISCORD_BOT_TOKEN remains VPS-only
```

Start this extra Node process alongside the existing bot:

```sh
cd /bot
pm2 start bridge-server.js --name guildos-bridge
pm2 save
pm2 logs guildos-bridge
```

The bridge listens only on loopback by default; do **not** change it to `0.0.0.0` or open TCP/3187 publicly.

## 2. TLS endpoint through Cloudflare Tunnel

Use Cloudflare Zero Trust → Networks → Tunnels to install `cloudflared` on the VPS and create a public hostname such as `guildos-bridge.example.com` routed to `http://127.0.0.1:3187`. This gives the Worker an HTTPS URL without opening an inbound VPS port. The bridge requires a long random Bearer secret on every request, including unknown paths. Add rate limiting at Cloudflare when practical.

The URL is an example, not a configured endpoint. If an Access policy protects the tunnel hostname, the Worker must also supply Access service-token headers (not currently implemented). Use the bridge's Bearer authentication and appropriate edge restrictions unless you extend the Worker with Access service tokens.

## 3. Cloudflare Worker/Pages secrets

In the **deployed** Cloudflare web project, Settings → Variables and Secrets, add:

- `GUILDOS_BRIDGE_URL` = `https://guildos-bridge.example.com` (your real tunnel hostname)
- `GUILDOS_BRIDGE_SECRET` = the *same* generated secret (Secret type)

Existing `SUPABASE_URL`, `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` remain required. Redeploy the web project after changing environment variables.

`DISCORD_BOT_TOKEN` does **not** need to be added to Cloudflare for channel lookups.

## 4. Test

First verify the private service on the VPS (substitute the shared secret yourself):

```sh
curl -i -H "Authorization: Bearer $GUILDOS_BRIDGE_SECRET" \
  http://127.0.0.1:3187/v1/guilds/YOUR_DISCORD_GUILD_SNOWFLAKE/channels
```

Should return JSON with `channels` and `categories`, provided the bot is in that guild. An unauthenticated request should return HTTP 401.

Check the Cloudflare dashboard's channel select after deployment. The channel API returns useful status-specific errors if the VPS bridge is unreachable, misconfigured, or unauthorized.

## Scope

This version routes **shared channel lookups, role lookups, bot hierarchy lookups, member listing, and member role add/remove** through the VPS. Other Discord operations (including moderation APIs and any other endpoint not named here) still use their existing implementation. Guilds with separately configured custom bots currently use the main bot for these bridge operations, and will need a per-custom-bot bridge integration. Do not remove old bot secrets from unrelated Cloudflare APIs until those endpoints are migrated.
