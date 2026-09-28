# Selv-hosting: GitHub + Cloudflare + egen Supabase

Denne guide flytter hele projektet til din egen infrastruktur.

## 1. Database (egen Supabase)

1. Opret projekt på supabase.com (allerede gjort: `rkdqunnttcyuybbofkvz`).
2. Kør de 8 SQL-dele (`bot-nethost-part01.sql` … `part08.sql`) i rækkefølge i SQL Editor — de indeholder skema + data.
3. Opret storage-bucket `ticket-transcripts` (privat) under Storage.
4. Sæt Discord-login op under Authentication → Providers → Discord:
   - Client ID + Secret fra Discord Developer Portal.
   - Redirect URL: brug den Supabase viser, og tilføj den i Discord Developer Portal under OAuth2 → Redirects.
5. Under Authentication → URL Configuration: sæt Site URL til dit domæne (fx `https://bot.nethost-solutions.dk`) og tilføj redirect URLs.

## 2. Koden på GitHub

```bash
git init
git add .
git commit -m "Self-host setup"
git remote add origin https://github.com/<dig>/<repo>.git
git push -u origin main
```

VIGTIGT: `.env` og `bot/.env` indeholder hemmeligheder. Tilføj dem til `.gitignore` og læg værdierne ind som secrets i stedet:

```
.env
bot/.env
```

## 3. Siden på Cloudflare

Projektet bygger med Nitro mod Cloudflare (allerede konfigureret i `vite.config.ts`).

**Cloudflare Workers/Pages:**
1. Cloudflare Dashboard → Workers & Pages → Create → forbind dit GitHub-repo.
2. Build command: `bun install && bun run build` (eller `npm install && npm run build`).
3. Output directory: `dist` (tjek `bun run build` lokalt første gang for at bekræfte mappenavnet).
4. Tilføj environment variables i Cloudflare:
   - `VITE_SUPABASE_URL` = `https://rkdqunnttcyuybbofkvz.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = din anon key
   - `SUPABASE_URL` = samme URL
   - `SUPABASE_SERVICE_ROLE_KEY` = din NYE service role key (fra nyt projekt)
   - `OPENAI_API_KEY` = din OpenAI API-nøgle (gem som Cloudflare Secret, aldrig som `VITE_`-variabel).
   - `BOT_SECRET_KEY` = `Z_!ZyMb4fw_gDxZ` (samme som botten bruger)
   - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`
5. Peg dit domæne (bot.nethost-solutions.dk) på Cloudflare-projektet.

## 4. Botten på din VPS

1. Pull repoet på VPS'en.
2. Udfyld `bot/.env`:
   - `SUPABASE_SERVICE_ROLE_KEY` = ny service role key
   - `APP_API_BASE` = dit domæne (når Cloudflare-siden er live)
3. `cd bot && npm install && node deployCommands.js`
4. Genstart: `pm2 restart ecosystem.config.js` (eller `pm2 start ecosystem.config.js`)

## 5. AI-funktioner (vigtigt!)

AI-screening, AI-chat, AI-automod, AI auto-responder, tekstforbedring og ticket summaries bruger nu OpenAI direkte fra server-ruterne.
- Opret en OpenAI API-nøgle.
- Tilføj `OPENAI_API_KEY` som en hemmelig Cloudflare Secret.
- Valgfrit: sæt `OPENAI_MODEL` for at overskrive standardmodellen (`gpt-6-luna`).
- De aktive AI-ruter bruger én fælles server-side OpenAI-klient med `gpt-6-luna` som standardmodel, timeout og ens fejlbehandling.
- OpenAI-nøglen må aldrig bruge `VITE_`-prefix og må aldrig sendes til browseren.

## 6. Tjekliste efter deploy

- [ ] Login med Discord virker (ellers: tjek redirect URLs i Supabase + Discord portal)
- [ ] Admin-board: tilføj din bruger i `user_roles` tabellen (role = `admin`)
- [ ] IP-whitelist: tilføj dine IP'er i `admin_ip_whitelist`
- [ ] Botten er online og svarer på kommandoer
- [ ] Realtime virker (dashboard opdaterer live)
