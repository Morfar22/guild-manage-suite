import type { DocPage } from '../types';

export const advancedPages: DocPage[] = [
  {
    slug: 'commands',
    category: 'advanced',
    title: { da: 'Kommando håndtering', en: 'Command management' },
    description: {
      da: 'Aktivér/deaktivér individuelle kommandoer pr. server. Sæt custom permissions.',
      en: 'Enable/disable individual commands per server. Set custom permissions.',
    },
  },
  {
    slug: 'custom-commands',
    category: 'advanced',
    title: { da: 'Custom Commands', en: 'Custom Commands' },
    description: {
      da: 'Opret dine egne kommandoer med custom svar (tekst, embed, billede).',
      en: 'Create your own commands with custom responses (text, embed, image).',
    },
  },
  {
    slug: 'bot-settings',
    category: 'advanced',
    title: { da: 'Bot Settings', en: 'Bot Settings' },
    description: {
      da: 'Server-specifikke indstillinger: prefix, sprog, timezone.',
      en: 'Server-specific settings: prefix, language, timezone.',
    },
  },
  {
    slug: 'custom-bots',
    category: 'advanced',
    title: { da: 'Custom Bots', en: 'Custom Bots' },
    description: {
      da: 'Premium feature: Brug din egen Discord bot token, så medlemmer ser DIT bot navn og avatar overalt.',
      en: 'Premium feature: Use your own Discord bot token so members see YOUR bot name and avatar everywhere.',
    },
    setupSteps: [
      { da: 'Opret en Discord application på discord.com/developers.', en: 'Create a Discord application at discord.com/developers.' },
      { da: 'Generer en bot token og kopier den.', en: 'Generate a bot token and copy it.' },
      { da: 'Indsæt token i Custom Bots fanen og inviter den til din server.', en: 'Paste the token in the Custom Bots tab and invite it to your server.' },
      { da: 'Aktivér Privileged Intents (Members, Presence, Message Content) i Dev Portal.', en: 'Enable Privileged Intents (Members, Presence, Message Content) in Dev Portal.' },
    ],
  },
  {
    slug: 'auto-reports',
    category: 'advanced',
    title: { da: 'Auto Reports', en: 'Auto Reports' },
    description: {
      da: 'Automatiske ugentlige/månedlige rapporter sendt til en kanal med server statistik.',
      en: 'Automatic weekly/monthly reports sent to a channel with server statistics.',
    },
  },
  {
    slug: 'characters',
    category: 'advanced',
    title: { da: 'Karakterer', en: 'Characters' },
    description: {
      da: 'Roleplay karakter system — brugere opretter profiler med stats, baggrund og inventory.',
      en: 'Roleplay character system — users create profiles with stats, background and inventory.',
    },
  },
];
