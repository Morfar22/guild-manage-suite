import {
  LayoutDashboard, Puzzle, Shield, Terminal, Settings,
  ScrollText, Ticket, ClipboardList, Users, UserPlus,
  TrendingUp, Smile, ShieldAlert, Coins, Gift, FileText, Twitch, Video,
  Mic, Sparkles, UserCog, Copy, Layers, Gamepad2, Star, Heart,
  Bell, History, FileBarChart, Brain,
  Calendar, Mail, AlertTriangle, ShoppingCart, Timer, Palette,
  Lightbulb, ShieldCheck, Archive, BarChart3, Vote, MessageSquare,
  Globe, Activity, Bot, Crown, Hash, Cake, Music, Server, Bug, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  end?: boolean;
}

export interface NavGroup {
  labelDa: string;
  labelEn: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    labelDa: 'Oversigt',
    labelEn: 'Overview',
    icon: LayoutDashboard,
    items: [
      { to: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', end: true },
      { to: '/dashboard/analytics', icon: BarChart3, labelKey: 'nav.analytics' },
      { to: '/dashboard/leaderboard', icon: TrendingUp, labelKey: 'nav.leaderboard' },
      { to: '/dashboard/live-events', icon: Activity, labelKey: 'nav.liveEvents' },
      { to: '/dashboard/bot-health', icon: Heart, labelKey: 'nav.botHealth' },
      { to: '/dashboard/resources', icon: Server, labelKey: 'nav.resources' },
      { to: '/dashboard/notifications', icon: Bell, labelKey: 'nav.notifications' },
    ],
  },
  {
    labelDa: 'Serverhåndtering',
    labelEn: 'Server Management',
    icon: Settings,
    items: [
      { to: '/dashboard/modules', icon: Puzzle, labelKey: 'nav.modules' },
      { to: '/dashboard/features', icon: Layers, labelKey: 'nav.features' },
      { to: '/dashboard/members', icon: UserCog, labelKey: 'nav.members' },
      { to: '/dashboard/welcome', icon: UserPlus, labelKey: 'nav.welcome' },
      { to: '/dashboard/invite-tracker', icon: Mail, labelKey: 'nav.inviteTracker' },
      { to: '/dashboard/stats-channels', icon: BarChart3, labelKey: 'nav.statsChannels' },
      { to: '/dashboard/role-analytics', icon: Crown, labelKey: 'nav.roleAnalytics' },
      { to: '/dashboard/activity-heatmap', icon: Activity, labelKey: 'nav.activityHeatmap' },
      { to: '/dashboard/webhooks', icon: Globe, labelKey: 'nav.webhooks' },
      { to: '/dashboard/backups', icon: Archive, labelKey: 'nav.backups' },
      { to: '/dashboard/server-clone', icon: Copy, labelKey: 'nav.serverClone' },
    ],
  },
  {
    labelDa: 'Moderering',
    labelEn: 'Moderation',
    icon: Shield,
    items: [
      { to: '/dashboard/moderation', icon: Shield, labelKey: 'nav.moderation' },
      { to: '/dashboard/operations', icon: Activity, labelKey: 'nav.operations' },
      { to: '/dashboard/warnings', icon: AlertTriangle, labelKey: 'nav.warnings' },
      { to: '/dashboard/automod', icon: ShieldAlert, labelKey: 'nav.automod' },
      { to: '/dashboard/ai-automod', icon: Brain, labelKey: 'nav.aiAutomod' },
      { to: '/dashboard/scheduled-actions', icon: Timer, labelKey: 'nav.scheduledActions' },
      { to: '/dashboard/logs', icon: ScrollText, labelKey: 'nav.logs' },
      { to: '/dashboard/log-settings', icon: FileText, labelKey: 'nav.logSettings' },
      { to: '/dashboard/verification', icon: ShieldCheck, labelKey: 'nav.verification' },
      { to: '/dashboard/raid-protection', icon: ShieldAlert, labelKey: 'nav.raidProtection' },
      { to: '/dashboard/slowmode-scheduler', icon: Timer, labelKey: 'nav.slowmodeScheduler' },
      { to: '/dashboard/quarantine', icon: ShieldCheck, labelKey: 'nav.quarantine' },
      { to: '/dashboard/honeypot', icon: Bug, labelKey: 'nav.honeypot' },
    ],
  },
  {
    labelDa: 'Engagement',
    labelEn: 'Engagement',
    icon: Sparkles,
    items: [
      { to: '/dashboard/leveling', icon: TrendingUp, labelKey: 'nav.leveling' },
      { to: '/dashboard/economy', icon: Coins, labelKey: 'nav.economy' },
      { to: '/dashboard/giveaways', icon: Gift, labelKey: 'nav.giveaways' },
      { to: '/dashboard/starboard', icon: Star, labelKey: 'nav.starboard' },
      { to: '/dashboard/polls', icon: Vote, labelKey: 'nav.polls' },
      { to: '/dashboard/suggestions', icon: Lightbulb, labelKey: 'nav.suggestions' },
      { to: '/dashboard/reaction-roles', icon: Smile, labelKey: 'nav.reactionRoles' },
      { to: '/dashboard/counting', icon: Hash, labelKey: 'nav.counting' },
      { to: '/dashboard/confessions', icon: MessageSquare, labelKey: 'nav.confessions' },
      { to: '/dashboard/birthdays', icon: Cake, labelKey: 'nav.birthdays' },
      { to: '/dashboard/music-quiz', icon: Music, labelKey: 'nav.musicQuiz' },
      { to: '/dashboard/currency-shop', icon: ShoppingCart, labelKey: 'nav.currencyShop' },
    ],
  },
  {
    labelDa: 'Kommunikation',
    labelEn: 'Communication',
    icon: Mail,
    items: [
      { to: '/dashboard/tickets', icon: Ticket, labelKey: 'nav.tickets' },
      { to: '/dashboard/modmail', icon: Mail, labelKey: 'nav.modmail' },
      { to: '/dashboard/applications', icon: ClipboardList, labelKey: 'nav.applications' },
      { to: '/dashboard/embed-builder', icon: Palette, labelKey: 'nav.embedBuilder' },
      { to: '/dashboard/auto-responders', icon: MessageSquare, labelKey: 'nav.autoResponders' },
      { to: '/dashboard/scheduler', icon: Calendar, labelKey: 'nav.scheduler' },
      { to: '/dashboard/reminders', icon: Bell, labelKey: 'nav.reminders' },
    ],
  },
  {
    labelDa: 'Kommandoer',
    labelEn: 'Commands',
    icon: Terminal,
    items: [
      { to: '/dashboard/commands', icon: Terminal, labelKey: 'nav.commands' },
      { to: '/dashboard/custom-commands', icon: Terminal, labelKey: 'nav.customCommands' },
    ],
  },
  {
    labelDa: 'Integrationer',
    labelEn: 'Integrations',
    icon: Globe,
    items: [
      { to: '/dashboard/twitch', icon: Twitch, labelKey: 'nav.twitch' },
      { to: '/dashboard/youtube', icon: Video, labelKey: 'nav.youtube' },
      { to: '/dashboard/tiktok', icon: Sparkles, labelKey: 'nav.tiktok' },
      { to: '/dashboard/tebex', icon: ShoppingCart, labelKey: 'nav.tebex' },
      { to: '/dashboard/fivem', icon: Gamepad2, labelKey: 'nav.fivem' },
      { to: '/dashboard/ai-chat', icon: Sparkles, labelKey: 'nav.aiChat' },
      { to: '/dashboard/jtc', icon: Mic, labelKey: 'nav.jtc' },
    ],
  },
  {
    labelDa: 'Avanceret',
    labelEn: 'Advanced',
    icon: Bot,
    items: [
      { to: '/dashboard/characters', icon: Users, labelKey: 'nav.characters' },
      { to: '/dashboard/bot-settings', icon: Bot, labelKey: 'nav.botSettings' },
      { to: '/dashboard/test-panel', icon: Activity, labelKey: 'nav.testPanel' },
      { to: '/dashboard/auto-reports', icon: FileBarChart, labelKey: 'nav.autoReports' },
      { to: '/dashboard/changelog', icon: History, labelKey: 'nav.changelog' },
    ],
  },
];

/** Flat list of all nav items for search */
export function getAllNavItems(): NavItem[] {
  return navGroups.flatMap(g => g.items);
}
