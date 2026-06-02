import type { DocPage } from '../types';

export const communicationPages: DocPage[] = [
  {
    slug: 'tickets',
    category: 'communication',
    title: { da: 'Tickets', en: 'Tickets' },
    description: {
      da: 'Komplet ticket system med kategorier, panels, claim, transscript og auto-close.',
      en: 'Full ticket system with categories, panels, claim, transcript and auto-close.',
    },
    setupSteps: [
      { da: 'Gå til Communication → Tickets → Settings.', en: 'Go to Communication → Tickets → Settings.' },
      { da: 'Opret en eller flere kategorier (Support, Bug Report, etc.).', en: 'Create one or more categories (Support, Bug Report, etc.).' },
      { da: 'Konfigurer panel embed og send det til en kanal.', en: 'Configure the panel embed and send it to a channel.' },
      { da: 'Sæt staff roller op der kan se og besvare tickets.', en: 'Set up staff roles that can view and respond to tickets.' },
    ],
    commands: [
      { name: '/ticket close', description: { da: 'Luk en ticket', en: 'Close a ticket' } },
      { name: '/ticket claim', description: { da: 'Claim en ticket', en: 'Claim a ticket' } },
      { name: '/ticket add', description: { da: 'Tilføj bruger til ticket', en: 'Add user to ticket' } },
    ],
  },
  {
    slug: 'modmail',
    category: 'communication',
    title: { da: 'Modmail', en: 'Modmail' },
    description: {
      da: '2-vejs DM bridge. Brugere skriver til botten i DM og staff svarer fra en thread.',
      en: '2-way DM bridge. Users DM the bot and staff reply from a thread.',
    },
  },
  {
    slug: 'applications',
    category: 'communication',
    title: { da: 'Ansøgninger', en: 'Applications' },
    description: {
      da: 'Lav ansøgningsformularer (staff, whitelist, etc.) med custom spørgsmål, review flow og auto-roller.',
      en: 'Build application forms (staff, whitelist, etc.) with custom questions, review flow and auto-roles.',
    },
  },
  {
    slug: 'embed-builder',
    category: 'communication',
    title: { da: 'Embed Builder', en: 'Embed Builder' },
    description: {
      da: 'Visuel embed editor med live preview. Gem og send rich embeds med farver, billeder, knapper.',
      en: 'Visual embed editor with live preview. Save and send rich embeds with colors, images, buttons.',
    },
  },
  {
    slug: 'auto-responders',
    category: 'communication',
    title: { da: 'Auto-Responders', en: 'Auto-Responders' },
    description: {
      da: 'Botten svarer automatisk når brugere skriver bestemte ord eller fraser.',
      en: 'Bot auto-replies when users type specific words or phrases.',
    },
  },
  {
    slug: 'scheduler',
    category: 'communication',
    title: { da: 'Beskeds scheduler', en: 'Message scheduler' },
    description: {
      da: 'Planlæg beskeder/embeds til at blive sendt på et bestemt tidspunkt eller intervaller.',
      en: 'Schedule messages/embeds to be sent at specific times or intervals.',
    },
  },
  {
    slug: 'reminders',
    category: 'communication',
    title: { da: 'Påmindelser', en: 'Reminders' },
    description: {
      da: 'Brugere kan sætte personlige påmindelser. Botten DMer dem på det rigtige tidspunkt.',
      en: 'Users can set personal reminders. The bot DMs them at the right time.',
    },
    commands: [
      { name: '/remind', description: { da: 'Sæt en påmindelse', en: 'Set a reminder' } },
      { name: '/reminders', description: { da: 'Vis dine påmindelser', en: 'Show your reminders' } },
    ],
  },
];
