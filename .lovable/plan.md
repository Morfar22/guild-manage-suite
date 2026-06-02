## Offentlig docs side (/docs)

GitBook-style dokumentationssite med sidebar, søgning og fuld i18n (dansk/engelsk).

### Routing & layout

- Ny offentlig route `/docs` (uden auth) + `/docs/:category/:slug`
- `DocsLayout` komponent: venstre sidebar (kategorier + sider), top header (logo, søgefelt, sprog-switch, tilbage til app), main content område
- Mobile: sidebar i Sheet/drawer
- Tilføjes til `App.tsx` udenfor `DashboardLayout`

### Indholdsstruktur

Statisk indhold i `src/docs/` som TypeScript-objekter (ikke DB) — nemmere at vedligeholde og hurtigere:

```
src/docs/
  index.ts              // kategori + side registry
  categories/
    getting-started/    // installation, invite bot, første ops.
    overview/           // dashboard, analytics, bot health
    server-management/  // welcome, invite tracker, stats, backups, clone
    moderation/         // moderation, warnings, automod, ai-automod, logs, verification, raid, slowmode, quarantine
    engagement/         // leveling, economy, giveaways, starboard, polls, suggestions, reaction-roles, counting, confessions, birthdays, music-quiz, currency-shop
    communication/      // tickets, modmail, applications, embed-builder, auto-responders, scheduler, reminders
    commands/           // slash + prefix commands, custom commands
    integrations/       // twitch, youtube, tiktok, tebex, fivem, ai-chat, jtc
    advanced/           // characters, bot-settings, custom bots, branding, webhooks
    faq/                // ofte stillede spørgsmål
    changelog/          // versionshistorik
    contact/            // support, discord, kontaktform
```

Hver side eksporterer:
```ts
{ slug, titleDa, titleEn, descriptionDa, descriptionEn, contentDa, contentEn, commands?: [], setupSteps?: [] }
```

### Komponenter

- `DocsLayout.tsx` — shell med sidebar/header
- `DocsSidebar.tsx` — kategorier (collapsible groups), aktiv side highlight
- `DocsSearch.tsx` — fuzzy search over alle sider (titel + beskrivelse + kommandoer), `Cmd+K` shortcut, popover med resultater
- `DocsContent.tsx` — renderer side: titel, beskrivelse, markdown body, command tabel, setup steps
- `DocsCommandTable.tsx` — tabel med slash + prefix kommandoer pr. modul
- `DocsLanguageSwitch.tsx` — bruger eksisterende `useLanguage()`
- `DocsBreadcrumbs.tsx` — kategori > side
- `DocsCodeBlock.tsx` — kopier-knap

### Sider (alle 60+ moduler)

Hver modul-side følger samme template:
1. **Hvad er det?** — kort beskrivelse
2. **Sådan sætter du det op** — trin-for-trin med dashboard-screenshots/links
3. **Kommandoer** — tabel (slash + prefix + beskrivelse + permissions)
4. **Eksempler** — typiske use cases
5. **Tips & FAQ** — modul-specifikke spørgsmål

Indholdet hentes fra:
- `bot/` handlere for kommando-info
- `src/lib/commands.ts` for slash command definitioner
- Eksisterende dashboard-sider for setup flow

### Søgning

Klient-side fuzzy search med `fuse.js` over hele indholds-arrayet. Søger på:
- Sidetitler
- Beskrivelser
- Kommando-navne
- Aliaser

Resultater grupperes pr. kategori, klik navigerer direkte til sektion.

### i18n

- Bruger eksisterende `LanguageContext` + `t()`
- Nye nøgler i `src/lib/translations.ts` for UI strings (sidebar labels, knapper, søgning)
- Indhold pr. side har `contentDa` + `contentEn` felter
- Sprog-switch i header (synkron med dashboardets sprog)

### SEO

- `<title>` pr. side: `{Side titel} – Docs – BotDash`
- Meta description fra `descriptionEn/Da`
- H1 pr. side, semantisk HTML
- Canonical URL
- JSON-LD `TechArticle` schema
- Sitemap entries for alle docs sider

### FAQ side

Accordion med kategorier:
- Bot ops & invite
- Premium & priser
- Custom bot
- Permissions & roller
- Modmail & tickets
- AI features
- Fejlfinding

### Changelog side

Statisk array med entries: `{ version, date, type: 'feature'|'fix'|'breaking', titleDa, titleEn, items[] }`. Renderet som tidslinje.

### Kontakt side

- Discord support server invite
- Email kontakt
- GitHub issues link
- Statusside/uptime
- Simpel kontaktform (valgfri — kan sende til eksisterende notification system eller email)

### Navigation fra resten af appen

- Link i `Index.tsx` (forsiden) — "Dokumentation" knap
- Link i dashboard sidebar bund — "📖 Docs"
- Link i Auth siden — "Læs docs"
- Footer på offentlige sider

### Dependencies

- `fuse.js` for fuzzy search (~6kb)
- `react-markdown` + `remark-gfm` for markdown rendering (eller plain JSX hvis indhold er TSX)

### Filer der oprettes

- `src/pages/Docs.tsx` (landing/oversigt)
- `src/pages/DocsPage.tsx` (individuel side)
- `src/components/docs/DocsLayout.tsx`
- `src/components/docs/DocsSidebar.tsx`
- `src/components/docs/DocsSearch.tsx`
- `src/components/docs/DocsContent.tsx`
- `src/components/docs/DocsCommandTable.tsx`
- `src/components/docs/DocsCodeBlock.tsx`
- `src/docs/index.ts` + alle kategori/side filer (~70 filer)
- `src/lib/translations.ts` udvides med docs nøgler
- `src/App.tsx` — nye routes

### Faser (anbefalet implementering)

På grund af omfanget (60+ moduler) foreslås implementering i 3 faser:

1. **Fase 1 (denne implementering):** Layout, søgning, i18n, getting-started, overview, FAQ, changelog, kontakt + 10 mest brugte moduler (tickets, modmail, automod, levels, economy, giveaways, welcome, logs, twitch, fivem)
2. **Fase 2:** Resterende ~30 moduler
3. **Fase 3:** Resterende moduler + screenshots/billeder

Dette holder første leverance overskuelig og giver dig mulighed for at se stilen før alle 60+ sider skrives.