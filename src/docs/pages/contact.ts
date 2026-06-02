import type { DocPage } from '../types';

export const contactPages: DocPage[] = [
  {
    slug: 'support',
    category: 'contact',
    title: { da: 'Support', en: 'Support' },
    description: {
      da: 'Brug for hjælp? Vi svarer hurtigt.',
      en: 'Need help? We respond quickly.',
    },
    sections: [
      {
        heading: { da: 'Discord Support Server', en: 'Discord Support Server' },
        body: {
          da: 'Den hurtigste vej til hjælp. Kom på vores Discord og spørg i #support kanalen.',
          en: 'The fastest way to get help. Join our Discord and ask in the #support channel.',
        },
      },
      {
        heading: { da: 'Email', en: 'Email' },
        body: {
          da: 'support@nethost-solutions.dk — svar inden for 24 timer på hverdage.',
          en: 'support@nethost-solutions.dk — reply within 24 hours on weekdays.',
        },
      },
      {
        heading: { da: 'Status', en: 'Status' },
        body: {
          da: 'Tjek bot status og evt. nedbrud på Bot Health siden i dashboardet.',
          en: 'Check bot status and outages on the Bot Health page in the dashboard.',
        },
      },
    ],
  },
];
