import type { DocPage } from '../types';

export const gettingStartedPages: DocPage[] = [
  {
    slug: 'introduction',
    category: 'getting-started',
    title: { da: 'Velkommen', en: 'Welcome' },
    description: {
      da: 'Komplet Discord bot platform med over 60 moduler — moderation, engagement, integrationer og meget mere.',
      en: 'Complete Discord bot platform with 60+ modules — moderation, engagement, integrations and more.',
    },
    sections: [
      {
        heading: { da: 'Hvad får du?', en: 'What do you get?' },
        body: {
          da: 'En kraftfuld Discord bot der kan håndtere alt fra moderation, tickets, modmail, applikationer, levels, økonomi, giveaways, til Twitch/YouTube/TikTok notifikationer og FiveM integration. Alt styres fra et moderne dashboard.',
          en: 'A powerful Discord bot that handles moderation, tickets, modmail, applications, levels, economy, giveaways, Twitch/YouTube/TikTok notifications, FiveM integration and more. Everything is managed from a modern dashboard.',
        },
      },
      {
        heading: { da: 'Hvordan virker det?', en: 'How does it work?' },
        body: {
          da: 'Du inviterer botten til din server, logger ind på dashboardet med Discord, vælger din server og konfigurerer modulerne du vil bruge. Ændringer træder i kraft øjeblikkeligt.',
          en: 'Invite the bot to your server, log in to the dashboard with Discord, select your server and configure the modules you want. Changes take effect instantly.',
        },
      },
    ],
  },
  {
    slug: 'invite-bot',
    category: 'getting-started',
    title: { da: 'Inviter botten', en: 'Invite the bot' },
    description: {
      da: 'Sådan tilføjer du botten til din Discord server.',
      en: 'How to add the bot to your Discord server.',
    },
    setupSteps: [
      { da: 'Klik på "Inviter Bot" knappen på forsiden.', en: 'Click the "Invite Bot" button on the homepage.' },
      { da: 'Vælg den server du vil tilføje botten til (kræver Administrator rettigheder).', en: 'Select the server you want to add the bot to (requires Administrator permissions).' },
      { da: 'Godkend de nødvendige permissions — botten har brug for omfattende rettigheder for at virke.', en: 'Approve the required permissions — the bot needs broad permissions to function.' },
      { da: 'Botten dukker nu op i din server. Du kan se den online i medlemslisten.', en: 'The bot appears in your server. You can see it online in the member list.' },
      { da: 'Gå til /dashboard, log ind med Discord og vælg din server.', en: 'Go to /dashboard, log in with Discord and select your server.' },
    ],
    tips: [
      { da: 'Hvis botten ikke svarer, tjek at den har tilladelse til at læse og skrive i den kanal du tester i.', en: 'If the bot does not respond, verify it has read and send permissions in the channel you are testing.' },
    ],
  },
  {
    slug: 'first-setup',
    category: 'getting-started',
    title: { da: 'Første opsætning', en: 'First setup' },
    description: {
      da: 'De vigtigste indstillinger at konfigurere efter du har inviteret botten.',
      en: 'The most important settings to configure after inviting the bot.',
    },
    setupSteps: [
      { da: 'Sæt log kanal op under Moderation → Log Settings så du kan se hvad botten gør.', en: 'Set up your log channel under Moderation → Log Settings to see what the bot does.' },
      { da: 'Konfigurer welcome beskeder under Server Management → Welcome.', en: 'Configure welcome messages under Server Management → Welcome.' },
      { da: 'Aktiver de moduler du vil bruge under Modules.', en: 'Enable the modules you want under Modules.' },
      { da: 'Sæt automod regler op for spam beskyttelse.', en: 'Set up automod rules for spam protection.' },
    ],
  },
  {
    slug: 'commands-overview',
    category: 'getting-started',
    title: { da: 'Kommandoer', en: 'Commands' },
    description: {
      da: 'Botten understøtter både slash kommandoer (/) og prefix kommandoer (!). Du kan ændre prefix i Bot Settings.',
      en: 'The bot supports both slash commands (/) and prefix commands (!). You can change the prefix in Bot Settings.',
    },
    sections: [
      {
        heading: { da: 'Slash kommandoer', en: 'Slash commands' },
        body: {
          da: 'Skriv / i en hvilken som helst kanal og vælg en kommando fra listen. Slash kommandoer har auto-complete og parameter validering.',
          en: 'Type / in any channel and pick a command from the list. Slash commands have auto-complete and parameter validation.',
        },
      },
      {
        heading: { da: 'Prefix kommandoer', en: 'Prefix commands' },
        body: {
          da: 'Skriv prefix fulgt af kommandoen, fx !ban @bruger spam. Prefix kan tilpasses pr. server.',
          en: 'Type the prefix followed by the command, e.g. !ban @user spam. The prefix is customizable per server.',
        },
      },
    ],
  },
];
