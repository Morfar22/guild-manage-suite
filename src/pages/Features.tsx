import { useState, useMemo } from 'react';
import { useGuildPremiumFeatures } from '@/hooks/useGuildPremiumFeatures';
import { PREMIUM_FEATURES, PremiumFeatureKey } from '@/lib/premium-features';
import {
  Shield, 
  TrendingUp, 
  Ticket, 
  ClipboardList, 
  Gift, 
  Coins, 
  Sparkles, 
  UserPlus, 
  Smile, 
  ShieldAlert, 
  Twitch, 
  Mic, 
  Copy, 
  ScrollText, 
  Users, 
  Terminal,
  Lock,
  CheckCircle2,
  Gamepad2,
  Search,
  Zap,
  ArrowRight,
  Bot,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Crown } from 'lucide-react';

// Map feature links to premium keys
const PREMIUM_LINK_MAP: Record<string, PremiumFeatureKey> = {
  '/dashboard/ai-chat': 'ai_chat',
  '/dashboard/fivem': 'fivem',
  '/dashboard/twitch': 'twitch',
  '/dashboard/server-clone': 'server_clone',
  '/dashboard/bot-settings': 'custom_bot',
  '/dashboard/global-bans': 'global_ban',
};

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  features: string[];
  link: string;
  category: 'moderation' | 'engagement' | 'utility' | 'integration';
  isNew?: boolean;
  isPopular?: boolean;
}

const allFeatures: Feature[] = [
  // Moderation
  {
    icon: ShieldAlert,
    title: 'Auto-Moderation',
    description: 'Automatisk beskyttelse mod spam, links og uønsket indhold',
    features: ['Spam detection', 'Link filter', 'Bad word filter', 'Caps lock filter', 'Mention spam', 'Custom regex', 'Exempt roller'],
    link: '/dashboard/automod',
    category: 'moderation',
    isPopular: true,
  },
  {
    icon: Shield,
    title: 'Moderation Tools',
    description: 'Komplet værktøjskasse til at holde din server sikker',
    features: ['Ban/Kick/Mute', 'Warn system', 'Timeout', 'Moderation logs', 'Bulk delete', 'Slowmode'],
    link: '/dashboard/moderation',
    category: 'moderation',
  },
  {
    icon: ScrollText,
    title: 'Event Logging',
    description: 'Log alle serverbegivenheder automatisk i en kanal',
    features: ['Message logs', 'Member logs', 'Voice logs', 'Role changes', 'Channel changes', 'Avatar changes', 'Invite tracking'],
    link: '/dashboard/log-settings',
    category: 'moderation',
  },
  {
    icon: Lock,
    title: 'IP Whitelisting',
    description: 'Begræns bot-adgang til specifikke IP-adresser',
    features: ['VPS IP whitelist', 'Sikker API adgang', 'Edge function beskyttelse', 'Admin-only'],
    link: '/admin',
    category: 'moderation',
  },

  // Engagement
  {
    icon: TrendingUp,
    title: 'Leveling System',
    description: 'XP og level system for øget engagement',
    features: ['Chat XP', 'Voice XP', 'Level-up roller', 'XP multipliers', 'Rank cards', 'Leaderboard', 'Blacklist channels'],
    link: '/dashboard/leveling',
    category: 'engagement',
    isPopular: true,
  },
  {
    icon: Coins,
    title: 'Economy System',
    description: 'Komplet virtuelt valutasystem',
    features: ['Wallet/Bank', 'Daily rewards', 'Work command', 'Transfer', 'Custom valuta', 'Transaktionslog'],
    link: '/dashboard/economy',
    category: 'engagement',
  },
  {
    icon: Gift,
    title: 'Giveaways',
    description: 'Opret og administrer giveaways med alle features',
    features: ['Timer-baseret', 'Rolle-krav', 'Flere vindere', 'Reroll', 'Embed preview', 'Auto-end'],
    link: '/dashboard/giveaways',
    category: 'engagement',
    isPopular: true,
  },
  {
    icon: Smile,
    title: 'Reaction Roles',
    description: 'Tildel roller via emoji-reaktioner',
    features: ['Custom embeds', 'Multiple panels', 'Emoji mapping', 'Role limits', 'Panel editor'],
    link: '/dashboard/reaction-roles',
    category: 'engagement',
  },

  // Utility
  {
    icon: Ticket,
    title: 'Ticket System',
    description: 'Avanceret support ticket system',
    features: ['Kategorier', 'Claim system', 'Transcripts', 'Custom spørgsmål', 'Staff roller', 'Panel embeds', 'Auto-close'],
    link: '/dashboard/tickets',
    category: 'utility',
    isPopular: true,
  },
  {
    icon: ClipboardList,
    title: 'Applications',
    description: 'Ansøgningssystem med review workflow',
    features: ['Custom forms', 'Multiple types', 'Review dashboard', 'Auto-roller', 'DM notifications', 'Approval/Deny'],
    link: '/dashboard/applications',
    category: 'utility',
  },
  {
    icon: Mic,
    title: 'Join to Create',
    description: 'Automatiske midlertidige voice kanaler',
    features: ['Auto-opret kanaler', 'Custom navne', 'User limit', 'Auto-slet', 'Aktive kanaler oversigt'],
    link: '/dashboard/jtc',
    category: 'utility',
  },
  {
    icon: UserPlus,
    title: 'Welcome System',
    description: 'Velkommen og farvel beskeder med embeds',
    features: ['Welcome embeds', 'Leave messages', 'DM welcome', 'Auto-rolle', 'Custom variabler', 'Test funktion', 'Embed preview'],
    link: '/dashboard/welcome',
    category: 'utility',
  },
  {
    icon: Users,
    title: 'Characters',
    description: 'Karakter management til RP servere',
    features: ['Character profiles', 'Multiple characters', 'Status tracking', 'Faction system', 'Avatar support'],
    link: '/dashboard/characters',
    category: 'utility',
  },
  {
    icon: Terminal,
    title: 'Commands',
    description: 'Administrer alle bot kommandoer',
    features: ['70+ commands', 'Toggle on/off', 'Kategori filter', 'Permission system', 'Søgefunktion'],
    link: '/dashboard/commands',
    category: 'utility',
  },

  // Integration
  {
    icon: Sparkles,
    title: 'AI Chat',
    description: 'AI-drevet chatbot med kontekst-hukommelse',
    features: ['Gemini Pro', 'Conversation memory', 'Custom system prompt', 'Kanal-specifik', 'Historik styring'],
    link: '/dashboard/ai-chat',
    category: 'integration',
    isNew: true,
  },
  {
    icon: Twitch,
    title: 'Twitch Integration',
    description: 'Live notifikationer når streamere går live',
    features: ['Multi-streamer', 'Custom embeds', 'Rolle mentions', 'Offline detection', 'Preview billeder'],
    link: '/dashboard/twitch',
    category: 'integration',
  },
  {
    icon: Copy,
    title: 'Server Clone',
    description: 'Komplet server backup og kloning',
    features: ['Roller & permissions', 'Kanaler', 'Progress tracking', 'Kategorier', 'Webhook backup'],
    link: '/dashboard/server-clone',
    category: 'integration',
  },
  {
    icon: Gamepad2,
    title: 'FiveM Integration',
    description: 'Komplet FiveM server management',
    features: ['Player whitelist', 'Steam/Discord sync', 'Playtime tracking', 'Priority system', 'Ban system', 'Live kommandoer', 'Online spillere'],
    link: '/dashboard/fivem',
    category: 'integration',
    isNew: true,
    isPopular: true,
  },
];

const categoryConfig: Record<string, { label: string; icon: React.ElementType; gradient: string; badge: string }> = {
  all: { 
    label: 'Alle Features', 
    icon: Zap,
    gradient: 'from-primary/20 to-primary/5',
    badge: 'bg-primary/10 text-primary border-primary/20'
  },
  moderation: { 
    label: 'Moderation', 
    icon: Shield,
    gradient: 'from-red-500/20 to-red-500/5',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20'
  },
  engagement: { 
    label: 'Engagement', 
    icon: TrendingUp,
    gradient: 'from-green-500/20 to-green-500/5',
    badge: 'bg-green-500/10 text-green-400 border-green-500/20'
  },
  utility: { 
    label: 'Utility', 
    icon: Terminal,
    gradient: 'from-blue-500/20 to-blue-500/5',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  },
  integration: { 
    label: 'Integration', 
    icon: Bot,
    gradient: 'from-purple-500/20 to-purple-500/5',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
  },
};

export default function Features() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { hasPremiumFeature } = useGuildPremiumFeatures();

  const filteredFeatures = useMemo(() => {
    let features = allFeatures;

    // Filter by category
    if (activeTab !== 'all') {
      features = features.filter(f => f.category === activeTab);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      features = features.filter(f => 
        f.title.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query) ||
        f.features.some(feat => feat.toLowerCase().includes(query))
      );
    }

    return features;
  }, [searchQuery, activeTab]);

  const stats = {
    total: allFeatures.length,
    moderation: allFeatures.filter(f => f.category === 'moderation').length,
    engagement: allFeatures.filter(f => f.category === 'engagement').length,
    utility: allFeatures.filter(f => f.category === 'utility').length,
    integration: allFeatures.filter(f => f.category === 'integration').length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            Feature Oversigt
          </h1>
          <p className="text-muted-foreground mt-2">
            {allFeatures.length} features på tværs af {Object.keys(categoryConfig).length - 1} kategorier
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg i features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background/50 border-border/50"
          />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(stats).map(([key, value]) => {
          const config = categoryConfig[key] || categoryConfig.all;
          const Icon = config.icon;
          return (
            <Card 
              key={key} 
              className={cn(
                "cursor-pointer transition-all border-border/50 hover:border-primary/30",
                activeTab === key && "border-primary/50 bg-primary/5"
              )}
              onClick={() => setActiveTab(key)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-gradient-to-br", config.gradient)}>
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{value}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {key === 'all' ? 'Total' : config.label}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start bg-background/50 border border-border/50 p-1 h-auto flex-wrap">
          {Object.entries(categoryConfig).map(([key, config]) => {
            const Icon = config.icon;
            const count = key === 'all' ? allFeatures.length : allFeatures.filter(f => f.category === key).length;
            return (
              <TabsTrigger 
                key={key} 
                value={key}
                className="flex items-center gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{config.label}</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-muted/50">
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredFeatures.length === 0 ? (
            <Card className="border-dashed border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground">Ingen features fundet</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Prøv at søge efter noget andet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredFeatures.map((feature) => {
                const categoryBadge = categoryConfig[feature.category];
                return (
                  <NavLink key={feature.title} to={feature.link}>
                    <Card className="h-full transition-all duration-300 border-border/50 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 cursor-pointer group relative overflow-hidden">
                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      <CardHeader className="pb-3 relative">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2.5 rounded-xl bg-gradient-to-br transition-all duration-300",
                              categoryConfig[feature.category].gradient,
                              "group-hover:scale-110"
                            )}>
                              <feature.icon className="h-5 w-5 text-foreground" />
                            </div>
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                {feature.title}
                                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                              </CardTitle>
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            {/* Premium badge */}
                            {PREMIUM_LINK_MAP[feature.link] && (
                              <Badge className={cn(
                                "text-[10px] px-1.5",
                                hasPremiumFeature(PREMIUM_LINK_MAP[feature.link])
                                  ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                  : "bg-muted text-muted-foreground border-border"
                              )}>
                                <Crown className="h-3 w-3 mr-0.5" />
                                Premium
                              </Badge>
                            )}
                            {feature.isNew && (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5">
                                NY
                              </Badge>
                            )}
                            {feature.isPopular && (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5">
                                ⭐
                              </Badge>
                            )}
                          </div>
                        </div>
                        <CardDescription className="mt-2 line-clamp-2">
                          {feature.description}
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className="pt-0 relative">
                        <div className="flex flex-wrap gap-1.5">
                          {feature.features.slice(0, 5).map((f) => (
                            <div 
                              key={f} 
                              className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md border border-border/30"
                            >
                              <CheckCircle2 className="h-3 w-3 text-green-500/70" />
                              {f}
                            </div>
                          ))}
                          {feature.features.length > 5 && (
                            <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md border border-border/30">
                              +{feature.features.length - 5} mere
                            </div>
                          )}
                        </div>
                        
                        {/* Category badge */}
                        <div className="mt-4 pt-3 border-t border-border/30">
                          <Badge variant="outline" className={cn("text-[10px]", categoryBadge.badge)}>
                            {categoryBadge.label}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </NavLink>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
