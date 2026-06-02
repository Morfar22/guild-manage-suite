import type { DocPage } from '../types';

export const changelogPages: DocPage[] = [
  {
    slug: 'changelog',
    category: 'changelog',
    title: { da: 'Changelog', en: 'Changelog' },
    description: { da: 'Seneste opdateringer og nye features.', en: 'Latest updates and new features.' },
    sections: [
      {
        heading: { da: 'Maj 2026', en: 'May 2026' },
        body: {
          da: '• Offentlig docs side\n• Per-guild bot branding\n• AI AutoMod forbedringer\n• Nye FiveM kommandoer',
          en: '• Public docs site\n• Per-guild bot branding\n• AI AutoMod improvements\n• New FiveM commands',
        },
      },
      {
        heading: { da: 'April 2026', en: 'April 2026' },
        body: {
          da: '• Music Quiz modul\n• Currency Shop\n• Birthday tracker\n• Confessions system',
          en: '• Music Quiz module\n• Currency Shop\n• Birthday tracker\n• Confessions system',
        },
      },
      {
        heading: { da: 'Marts 2026', en: 'March 2026' },
        body: {
          da: '• Raid Protection\n• Quarantine system\n• Slowmode scheduler\n• Counting kanal',
          en: '• Raid Protection\n• Quarantine system\n• Slowmode scheduler\n• Counting channel',
        },
      },
    ],
  },
];
