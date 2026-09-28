## Mål

Forvandle det eksisterende ansøgningssystem (5 sider, 4 tabeller, 2 edge functions, 1 bot-handler) til en **Pro-version** med AI-screening, interview-tickets, analytics, multi-stage workflow, dropdown-paneler og free/premium-gating.

## Hvad findes allerede

- Tabeller: `application_forms`, `application_submissions`, `application_settings`, `applications`
- Sider: `Applications.tsx`, `ApplicationFormEdit.tsx`, `ApplicationList.tsx`, `ApplicationReview.tsx`, `ApplicationSettings.tsx`
- Edge functions: `application-handler` (panel/modal/submit), `review-application` (approve/deny)
- Bot: `applicationHandler.js` (knap + slash command)
- Frie funktioner i dag: custom forms, knap-panel, modal-submit, approve/deny, granted role, cooldown

## Hvad bygges (Pro-laget)

### 1. Database — udvidelser
```text
application_forms:
  + panel_style          ('buttons' | 'dropdown' | 'both')   default 'buttons'
  + ai_screening_enabled boolean default false
  + ai_screening_prompt  text    (custom instruktion til AI)
  + ai_auto_threshold    int     (auto-approve hvis score >= X, null = manuel)
  + interview_enabled    boolean default false
  + interview_questions  jsonb   (spørgsmål stillet i interview-tråd)
  + interview_category_id text   (Discord kategori-ID)
  + stages               jsonb   (multi-stage: screening → interview → final)
  + min_account_age_days int
  + blacklist_role_ids   text[]
  + max_pending_per_user int     default 1

application_submissions:
  + ai_score             int      (0-100)
  + ai_summary           text
  + ai_flags             jsonb    (toxicity, inconsistency, missing-info)
  + current_stage        text     ('screening' | 'interview' | 'final' | 'completed')
  + interview_thread_id  text
  + interview_answers    jsonb
  + votes                jsonb    ([{reviewer_id, vote: 'up'|'down', note}])

ny tabel: application_audit_log
  (submission_id, actor_id, action, payload, created_at)
```

Free-tier-limits enforces via DB-trigger:
- Free: max 1 form pr. guild, max 5 spørgsmål, ingen AI/interview/multi-stage
- Premium: ubegrænset (tjek mod `premium_subscriptions` tabellen)

### 2. Edge Functions

**Eksisterende `application-handler`** udvides:
- Tjek premium-status før features bruges
- Send dropdown-panel (StringSelectMenu) udover knapper
- Tjek account-age, blacklist-roles, max-pending før modal vises
- Skab interview-tråd hvis `interview_enabled` ved submit

**AI-function: `ai-screen-application`** (OpenAI)
- Trigger ved submit
- Sender svar + `ai_screening_prompt` til OpenAI
- Returnerer `{score, summary, flags}` → opdaterer submission
- Hvis score ≥ `ai_auto_threshold` → auto-approve via `review-application`

**Eksisterende `review-application`** udvides:
- Voting: optælling af staff-stemmer
- Multi-stage flow: ved approve advancer til næste stage
- Audit-log skrivning

**Ny edge function: `export-applications`**
- Filtreret CSV-eksport (status, form, periode)
- Returnerer downloadbar fil

### 3. Bot (`/dev-server/bot/applicationHandler.js`)
- Tilføj dropdown-handler (`StringSelectMenuInteraction`)
- Tilføj slash-command `/apply` med autocomplete på forms
- Lyt på modmail-style replies i interview-tråd → gem som `interview_answers`
- Knapper på review-embed: ✅ Approve, ❌ Deny, 👍 Vote up, 👎 Vote down, 📝 Note, ➡️ Næste stage

### 4. Frontend — Pro UI

**Ny side: `ApplicationAnalytics.tsx`**
- KPI-kort: pending / approved / denied / avg-tid-til-svar / approval-rate
- Charts (Recharts): submissions over tid, status-fordeling, AI-score distribution, top reviewers
- Filter: form, periode

**`ApplicationFormEdit.tsx` udvides**
- Tabs: Spørgsmål · Panel · AI-screening · Interview · Avanceret
- Drag-and-drop reorder af spørgsmål (dnd-kit)
- Conditional logic-editor (vis spørgsmål Y hvis svar på X = Z)
- Account-age, blacklist, max-pending
- "Premium-låst"-overlay på Pro-felter for free-guilds

**`ApplicationReview.tsx` udvides**
- AI-score badge + summary + flags
- Voting-knapper + staff-noter timeline
- Stage-progress (screening → interview → final)
- Interview-svar vises inline
- Audit-log i sidepanel

**`ApplicationList.tsx` udvides**
- CSV-eksport knap
- Filter på AI-score, stage, dato-range
- Bulk-actions (approve flere)

**`ApplicationSettings.tsx` udvides**
- Default panel style
- Default review-channel
- Notification webhooks

### 5. Premium-gating

- Centraliseret helper `useGuildPremium(guildId)` (findes muligvis allerede via `premium_subscriptions`)
- Pro-faner og felter wrappes i `<PremiumLock>`-komponent
- Server-side enforcement i edge functions og DB-trigger (klient kan ikke omgås)

### 6. Design / "pænere end Appy"

- Animerede status-badges (Framer Motion)
- Gradient-baggrunde på review-cards
- AI-score som circular progress-ring
- Diff-view ved reapply (gamle vs nye svar)
- Mørk premium-glow på Pro-features

## Teknisk

- AI: OpenAI via server-side `OPENAI_API_KEY` (standardmodel `gpt-5.6-luna`)
- Realtime: subscribe på `application_submissions` i review-siden så nye ansøgninger popper ind live
- Notifikationer: bot DM'er ansøger ved hver status-ændring
- Sikkerhed: RLS opdateres så `application_audit_log` kun læses af guild-admins; AI-felter kun skrivbare af service_role

## Leverancer i rækkefølge

1. DB-migration (nye kolonner, audit-tabel, free-limit trigger)
2. Edge functions (`ai-screen-application`, `export-applications`, opdatér de to eksisterende)
3. Bot-handler (dropdown, slash, interview-tråd)
4. Frontend Pro UI (tabs, analytics, voting, lock-overlays)
5. Polish & test

## Spørgsmål før jeg starter

Er der allerede en `premium_subscriptions`-tabel jeg skal bruge til gating, eller skal jeg lave en ny? Hvis du har en betalingsflow (Stripe/Tebex) tilkoblet, så peg mig på den så premium-checken bliver automatisk i stedet for manuel.
