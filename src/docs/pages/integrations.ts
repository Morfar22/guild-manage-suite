import type { DocPage } from '../types';

export const integrationsPages: DocPage[] = [
  {
    slug: 'twitch',
    category: 'integrations',
    title: { da: 'Twitch', en: 'Twitch' },
    description: {
      da: 'Notifikationer når dine streamers går live + ugentlig stream skema embed.',
      en: 'Notifications when your streamers go live + weekly stream schedule embed.',
    },
    setupSteps: [
      { da: 'Gå til Integrations → Twitch.', en: 'Go to Integrations → Twitch.' },
      { da: 'Tilføj Twitch usernames du vil tracke.', en: 'Add Twitch usernames to track.' },
      { da: 'Vælg notifikations kanal og custom besked.', en: 'Pick notification channel and custom message.' },
    ],
  },
  {
    slug: 'youtube',
    category: 'integrations',
    title: { da: 'YouTube', en: 'YouTube' },
    description: {
      da: 'Notifikationer når kanaler uploader nye videoer (RSS-baseret, ingen API key nødvendig).',
      en: 'Notifications when channels upload new videos (RSS-based, no API key needed).',
    },
  },
  {
    slug: 'tiktok',
    category: 'integrations',
    title: { da: 'TikTok', en: 'TikTok' },
    description: {
      da: 'Notifikationer når TikTok kreatører posts nye videoer.',
      en: 'Notifications when TikTok creators post new videos.',
    },
  },
  {
    slug: 'tebex',
    category: 'integrations',
    title: { da: 'Tebex', en: 'Tebex' },
    description: {
      da: 'Tebex webshop integration — automatisk roller efter køb, donation feed, statistikker.',
      en: 'Tebex webshop integration — auto-roles after purchase, donation feed, statistics.',
    },
  },
  {
    slug: 'fivem',
    category: 'integrations',
    title: { da: 'FiveM', en: 'FiveM' },
    description: {
      da: '52+ FiveM kommandoer: kick, ban, give item, set job, teleport, spawn vehicle og meget mere. Komplet Lua resource medfølger.',
      en: '52+ FiveM commands: kick, ban, give item, set job, teleport, spawn vehicle and more. Complete Lua resource included.',
    },
    setupSteps: [
      { da: 'Download Lua resource fra Integrations → FiveM.', en: 'Download Lua resource from Integrations → FiveM.' },
      { da: 'Læg den i din FiveM server resources mappe.', en: 'Place it in your FiveM server resources folder.' },
      { da: 'Sæt convars: bot_secret, guild_id.', en: 'Set convars: bot_secret, guild_id.' },
      { da: 'Start resource og link til din Discord guild.', en: 'Start resource and link to your Discord guild.' },
    ],
  },
  {
    slug: 'ai-chat',
    category: 'integrations',
    title: { da: 'AI Chat', en: 'AI Chat' },
    description: {
      da: 'Gemini-drevet chatbot. Aktiver pr. kanal, custom personality, beskytte staff IDs.',
      en: 'Gemini-powered chatbot. Enable per channel, custom personality, protect staff IDs.',
    },
  },
  {
    slug: 'jtc',
    category: 'integrations',
    title: { da: 'Join to Create', en: 'Join to Create' },
    description: {
      da: 'Voice kanaler der automatisk opretter en privat kanal til den der joiner. Owner kontrol via panel.',
      en: 'Voice channels that auto-create a private channel for whoever joins. Owner control via panel.',
    },
  },
];
