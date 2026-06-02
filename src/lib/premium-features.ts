import { Sparkles, Gamepad2, Bot, Copy, Twitch, Shield, Mic, Star, ClipboardList } from 'lucide-react';

export const PREMIUM_FEATURES = {
  ai_chat: { name: 'AI Chat', icon: Sparkles, description: 'AI-drevet chatbot med kontekst-hukommelse' },
  fivem: { name: 'FiveM Integration', icon: Gamepad2, description: 'Komplet FiveM server management' },
  custom_bot: { name: 'Custom Bot', icon: Bot, description: 'Brug din egen Discord bot' },
  server_clone: { name: 'Server Clone', icon: Copy, description: 'Server backup og kloning' },
  twitch: { name: 'Twitch Integration', icon: Twitch, description: 'Live notifikationer for streamere' },
  global_ban: { name: 'Global Ban System', icon: Shield, description: 'Cross-server ban system' },
  jtc: { name: 'Join to Create', icon: Mic, description: 'Automatisk oprettelse af stemmekanaler' },
  starboard: { name: 'Starboard', icon: Star, description: 'Highlight populære beskeder automatisk' },
  applications: { name: 'Ansøgninger', icon: ClipboardList, description: 'Tilpassede ansøgningsformularer med review' },
  tiktok: { name: 'TikTok Integration', icon: Sparkles, description: 'Notifikationer for nye TikTok videoer og auto-embed' },
} as const;

export type PremiumFeatureKey = keyof typeof PREMIUM_FEATURES;

export const PREMIUM_FEATURE_KEYS = Object.keys(PREMIUM_FEATURES) as PremiumFeatureKey[];
