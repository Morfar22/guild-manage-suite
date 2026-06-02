import type { DocPage } from '../types';

export const overviewPages: DocPage[] = [
  {
    slug: 'dashboard',
    category: 'overview',
    title: { da: 'Dashboard', en: 'Dashboard' },
    description: {
      da: 'Hovedsiden viser quick stats, status alerts og genveje til de moduler du bruger mest.',
      en: 'The main page shows quick stats, status alerts and shortcuts to the modules you use most.',
    },
  },
  {
    slug: 'analytics',
    category: 'overview',
    title: { da: 'Analytics', en: 'Analytics' },
    description: {
      da: 'Detaljeret analytics over beskeder, joins/leaves, voice tid, kommando brug — opdateret hver time.',
      en: 'Detailed analytics on messages, joins/leaves, voice time, command usage — updated hourly.',
    },
  },
  {
    slug: 'leaderboard',
    category: 'overview',
    title: { da: 'Leaderboard', en: 'Leaderboard' },
    description: {
      da: 'Top brugere på XP, beskeder og voice tid.',
      en: 'Top users by XP, messages and voice time.',
    },
  },
  {
    slug: 'live-events',
    category: 'overview',
    title: { da: 'Live Events', en: 'Live Events' },
    description: {
      da: 'Realtime feed af alt hvad der sker i din server — beskeder, joins, mod actions.',
      en: 'Realtime feed of everything happening in your server — messages, joins, mod actions.',
    },
  },
  {
    slug: 'bot-health',
    category: 'overview',
    title: { da: 'Bot Health', en: 'Bot Health' },
    description: {
      da: 'Live status: uptime, ping, RAM brug, gateway status og console logs.',
      en: 'Live status: uptime, ping, RAM usage, gateway status and console logs.',
    },
  },
];
