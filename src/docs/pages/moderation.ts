import type { DocPage } from '../types';

export const moderationPages: DocPage[] = [
  {
    slug: 'moderation',
    category: 'moderation',
    title: { da: 'Moderation', en: 'Moderation' },
    description: {
      da: 'Komplet moderation suite med ban, kick, mute, warn og automatisk handlinger.',
      en: 'Full moderation suite with ban, kick, mute, warn and automated actions.',
    },
    commands: [
      { name: '/ban', prefix: '!ban', description: { da: 'Banner en bruger', en: 'Ban a user' }, permission: 'BAN_MEMBERS' },
      { name: '/kick', prefix: '!kick', description: { da: 'Kicker en bruger', en: 'Kick a user' }, permission: 'KICK_MEMBERS' },
      { name: '/mute', prefix: '!mute', description: { da: 'Muter en bruger med varighed', en: 'Mute a user with duration' }, permission: 'MODERATE_MEMBERS' },
      { name: '/unmute', prefix: '!unmute', description: { da: 'Fjerner mute', en: 'Remove mute' }, permission: 'MODERATE_MEMBERS' },
      { name: '/warn', prefix: '!warn', description: { da: 'Giver en advarsel', en: 'Give a warning' }, permission: 'MODERATE_MEMBERS' },
      { name: '/purge', prefix: '!purge', description: { da: 'Sletter beskeder', en: 'Delete messages' }, permission: 'MANAGE_MESSAGES' },
      { name: '/slowmode', prefix: '!slowmode', description: { da: 'Sætter slowmode', en: 'Set slowmode' }, permission: 'MANAGE_CHANNELS' },
    ],
  },
  {
    slug: 'warnings',
    category: 'moderation',
    title: { da: 'Advarsler', en: 'Warnings' },
    description: {
      da: 'Point-baseret advarsels system med automatiske handlinger ved tærskler.',
      en: 'Point-based warning system with automated actions at thresholds.',
    },
    setupSteps: [
      { da: 'Gå til Moderation → Warnings.', en: 'Go to Moderation → Warnings.' },
      { da: 'Definer point pr. advarsels-type.', en: 'Define points per warning type.' },
      { da: 'Sæt tærskler op (fx 10 point = mute, 20 = ban).', en: 'Set thresholds (e.g. 10 points = mute, 20 = ban).' },
    ],
    commands: [
      { name: '/warnings', prefix: '!warnings', description: { da: 'Vis brugerens advarsler', en: 'Show user warnings' } },
      { name: '/clearwarnings', description: { da: 'Slet alle advarsler', en: 'Clear all warnings' }, permission: 'MODERATE_MEMBERS' },
    ],
  },
  {
    slug: 'automod',
    category: 'moderation',
    title: { da: 'AutoMod', en: 'AutoMod' },
    description: {
      da: 'Automatisk filtrering af spam, links, invites, badwords, caps og mentions.',
      en: 'Automatic filtering of spam, links, invites, badwords, caps and mentions.',
    },
    sections: [
      {
        heading: { da: 'Tilgængelige regler', en: 'Available rules' },
        body: {
          da: 'Spam, gentagne beskeder, masse mentions, store bogstaver, invite links, eksterne links, badwords liste, zalgo tekst, emoji spam.',
          en: 'Spam, repeated messages, mass mentions, caps, invite links, external links, badwords list, zalgo text, emoji spam.',
        },
      },
      {
        heading: { da: 'Bypass roller', en: 'Bypass roles' },
        body: {
          da: 'Du kan tilføje roller der bypasser ALLE automod regler under Bypass Roles fanen.',
          en: 'You can add roles that bypass ALL automod rules under the Bypass Roles tab.',
        },
      },
    ],
  },
  {
    slug: 'ai-automod',
    category: 'moderation',
    title: { da: 'AI AutoMod', en: 'AI AutoMod' },
    description: {
      da: 'AI-drevet toxicity detection med Gemini. Fanger trusler, hate speech og chikane som regulær automod misser.',
      en: 'AI-powered toxicity detection with Gemini. Catches threats, hate speech and harassment that regular automod misses.',
    },
    setupSteps: [
      { da: 'Aktiver AI AutoMod under Moderation → AI AutoMod.', en: 'Enable AI AutoMod under Moderation → AI AutoMod.' },
      { da: 'Vælg sensitivity (low/medium/high).', en: 'Choose sensitivity (low/medium/high).' },
      { da: 'Vælg handling: warn, delete, mute eller ban.', en: 'Choose action: warn, delete, mute or ban.' },
    ],
  },
  {
    slug: 'logs',
    category: 'moderation',
    title: { da: 'Logs', en: 'Logs' },
    description: {
      da: '20+ log events: beskeder slettet/redigeret, medlemmer joinet/forladt, roller ændret, kanaler oprettet, voice activity, og meget mere.',
      en: '20+ log events: messages deleted/edited, members joined/left, roles changed, channels created, voice activity, and more.',
    },
    setupSteps: [
      { da: 'Gå til Moderation → Log Settings.', en: 'Go to Moderation → Log Settings.' },
      { da: 'Vælg en kanal pr. event-type (eller én kanal til alt).', en: 'Pick a channel per event type (or one channel for everything).' },
      { da: 'Toggle hvilke events du vil logge.', en: 'Toggle which events to log.' },
    ],
  },
  {
    slug: 'verification',
    category: 'moderation',
    title: { da: 'Verifikation', en: 'Verification' },
    description: {
      da: 'Anti-raid verifikation panel. Nye medlemmer skal trykke en knap eller løse en captcha for at få adgang.',
      en: 'Anti-raid verification panel. New members must click a button or solve a captcha to gain access.',
    },
  },
  {
    slug: 'raid-protection',
    category: 'moderation',
    title: { da: 'Raid beskyttelse', en: 'Raid Protection' },
    description: {
      da: 'Detekter raids automatisk baseret på join-rate og tag handling: lockdown, kick, ban.',
      en: 'Auto-detect raids based on join rate and take action: lockdown, kick, ban.',
    },
  },
  {
    slug: 'quarantine',
    category: 'moderation',
    title: { da: 'Karantæne', en: 'Quarantine' },
    description: {
      da: 'Isolér mistænkelige brugere midlertidigt uden at banne dem.',
      en: 'Temporarily isolate suspicious users without banning them.',
    },
  },
  {
    slug: 'scheduled-actions',
    category: 'moderation',
    title: { da: 'Planlagte handlinger', en: 'Scheduled Actions' },
    description: {
      da: 'Planlæg unbans, unmutes og rolle-tildelinger til at ske automatisk på et bestemt tidspunkt.',
      en: 'Schedule unbans, unmutes and role assignments to happen automatically at a specific time.',
    },
  },
];
