import type { DocPage } from '../types';

export const faqPages: DocPage[] = [
  {
    slug: 'general',
    category: 'faq',
    title: { da: 'Generelle spørgsmål', en: 'General questions' },
    description: { da: 'De mest stillede spørgsmål.', en: 'The most asked questions.' },
    sections: [
      {
        heading: { da: 'Er botten gratis?', en: 'Is the bot free?' },
        body: {
          da: 'Ja, kerne-funktionerne er 100% gratis. Premium tilbyder ekstra features som custom bot branding og højere limits.',
          en: 'Yes, core features are 100% free. Premium offers extras like custom bot branding and higher limits.',
        },
      },
      {
        heading: { da: 'Hvor mange servere virker botten i?', en: 'How many servers does the bot work in?' },
        body: { da: 'Ubegrænset.', en: 'Unlimited.' },
      },
      {
        heading: { da: 'Botten svarer ikke — hvad gør jeg?', en: 'The bot does not respond — what do I do?' },
        body: {
          da: '1) Tjek at botten er online. 2) Tjek at den har permissions i kanalen. 3) Tjek at modulet er aktiveret under Modules.',
          en: '1) Check the bot is online. 2) Check it has channel permissions. 3) Check the module is enabled under Modules.',
        },
      },
      {
        heading: { da: 'Hvor gemmes mine data?', en: 'Where is my data stored?' },
        body: {
          da: 'Sikkert i EU på krypterede databaser. Vi sælger ALDRIG data og deler ikke med tredjeparter.',
          en: 'Securely in the EU on encrypted databases. We NEVER sell data or share with third parties.',
        },
      },
    ],
  },
  {
    slug: 'permissions',
    category: 'faq',
    title: { da: 'Permissions & Roller', en: 'Permissions & Roles' },
    description: { da: 'Spørgsmål om bot rettigheder.', en: 'Questions about bot permissions.' },
    sections: [
      {
        heading: { da: 'Hvorfor skal botten have Administrator?', en: 'Why does the bot need Administrator?' },
        body: {
          da: 'Det skal den ikke nødvendigvis. Du kan give den specifikke permissions, men Administrator er nemmest for at undgå "missing permissions" fejl.',
          en: 'It does not have to. You can give specific permissions, but Administrator is easiest to avoid "missing permissions" errors.',
        },
      },
      {
        heading: { da: 'Hvordan giver jeg staff adgang til dashboardet?', en: 'How do I give staff dashboard access?' },
        body: {
          da: 'Brugere med Manage Server permission kan logge ind på dashboardet for den server.',
          en: 'Users with Manage Server permission can log into the dashboard for that server.',
        },
      },
    ],
  },
  {
    slug: 'troubleshooting',
    category: 'faq',
    title: { da: 'Fejlfinding', en: 'Troubleshooting' },
    description: { da: 'Løsninger på almindelige problemer.', en: 'Solutions to common problems.' },
    sections: [
      {
        heading: { da: 'Slash kommandoer dukker ikke op', en: 'Slash commands not showing' },
        body: {
          da: 'Gå til Dashboard → Commands og klik "Deploy commands". Kan tage op til 1 minut.',
          en: 'Go to Dashboard → Commands and click "Deploy commands". Can take up to 1 minute.',
        },
      },
      {
        heading: { da: 'Welcome beskeder sendes ikke', en: 'Welcome messages not sending' },
        body: {
          da: 'Tjek at modulet er aktiveret, kanalen er sat, og botten har send permissions i kanalen.',
          en: 'Check the module is enabled, channel is set, and bot has send permissions in the channel.',
        },
      },
    ],
  },
];
