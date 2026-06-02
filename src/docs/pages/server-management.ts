import type { DocPage } from '../types';

export const serverManagementPages: DocPage[] = [
  {
    slug: 'welcome',
    category: 'server-management',
    title: { da: 'Velkomst', en: 'Welcome' },
    description: {
      da: 'Custom welcome beskeder med variabler ({user}, {server}, {membercount}), embeds, banner billeder og auto-roller.',
      en: 'Custom welcome messages with variables ({user}, {server}, {membercount}), embeds, banner images and auto-roles.',
    },
  },
  {
    slug: 'invite-tracker',
    category: 'server-management',
    title: { da: 'Invite Tracker', en: 'Invite Tracker' },
    description: {
      da: 'Tracker hvem der inviterer hvem. Statistik over top inviters og fake/left invites.',
      en: 'Tracks who invites whom. Stats on top inviters and fake/left invites.',
    },
  },
  {
    slug: 'stats-channels',
    category: 'server-management',
    title: { da: 'Stats Kanaler', en: 'Stats Channels' },
    description: {
      da: 'Voice kanaler der automatisk viser server statistik (medlemmer, online, boosters, etc.) i navnet.',
      en: 'Voice channels that auto-display server stats (members, online, boosters, etc.) in their name.',
    },
  },
  {
    slug: 'role-analytics',
    category: 'server-management',
    title: { da: 'Rolle Analytics', en: 'Role Analytics' },
    description: {
      da: 'Statistik over rolle fordeling, ændringer over tid og top roller.',
      en: 'Stats on role distribution, changes over time and top roles.',
    },
  },
  {
    slug: 'activity-heatmap',
    category: 'server-management',
    title: { da: 'Aktivitets Heatmap', en: 'Activity Heatmap' },
    description: {
      da: 'Visuel heatmap af medlemsaktivitet pr. time/dag. Find dine mest aktive tidspunkter.',
      en: 'Visual heatmap of member activity per hour/day. Find your most active times.',
    },
  },
  {
    slug: 'webhooks',
    category: 'server-management',
    title: { da: 'Webhooks', en: 'Webhooks' },
    description: {
      da: 'Manage webhook integrationer til eksterne services (GitHub, Stripe, custom).',
      en: 'Manage webhook integrations to external services (GitHub, Stripe, custom).',
    },
  },
  {
    slug: 'backups',
    category: 'server-management',
    title: { da: 'Backups', en: 'Backups' },
    description: {
      da: 'Tag fuld backup af din server (kanaler, roller, permissions). Restore på få minutter.',
      en: 'Take full backup of your server (channels, roles, permissions). Restore in minutes.',
    },
  },
  {
    slug: 'server-clone',
    category: 'server-management',
    title: { da: 'Server Clone', en: 'Server Clone' },
    description: {
      da: '1:1 kloning af en server til en anden — kanaler, kategorier, roller og permissions.',
      en: '1:1 clone of one server to another — channels, categories, roles and permissions.',
    },
  },
  {
    slug: 'members',
    category: 'server-management',
    title: { da: 'Medlemmer', en: 'Members' },
    description: {
      da: 'Browse, søg og bulk-action alle medlemmer fra dashboardet.',
      en: 'Browse, search and bulk-action all members from the dashboard.',
    },
  },
];
