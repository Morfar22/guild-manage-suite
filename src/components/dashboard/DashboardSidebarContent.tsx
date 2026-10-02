import { useLocation, useNavigate } from '@tanstack/react-router';
import { NavLink } from '@/components/NavLink';
import { cn } from '@/lib/utils';
import { useGuild } from '@/contexts/GuildContext';
import { useGuildPremiumFeatures } from '@/hooks/useGuildPremiumFeatures';
import { PremiumFeatureKey } from '@/lib/premium-features';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot, ChevronDown, ChevronRight, LogOut, Moon, Sun, Settings,
  Lock, Crown, Globe, Star,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/contexts/LanguageContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BotStatusIndicator } from './BotStatusIndicator';
import { CommandPalette } from './CommandPalette';
import { useFavoritePages } from '@/hooks/useFavoritePages';
import { navGroups, getAllNavItems } from '@/lib/nav-items';
import { useState, useCallback } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const PREMIUM_NAV_MAP: Record<string, PremiumFeatureKey> = {
  '/dashboard/ai-chat': 'ai_chat',
  '/dashboard/fivem': 'fivem',
  '/dashboard/twitch': 'twitch',
  '/dashboard/tiktok': 'tiktok',
  '/dashboard/server-clone': 'server_clone',
  '/dashboard/bot-settings': 'custom_bot',
};

interface DashboardSidebarContentProps {
  onNavigate?: () => void;
}

export function DashboardSidebarContent({ onNavigate }: DashboardSidebarContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedGuild } = useGuild();
  const { user, signOut } = useAuth();
  const { setTheme, theme } = useTheme();
  const { hasPremiumFeature } = useGuildPremiumFeatures();
  const { t, language, setLanguage } = useLanguage();
  const { favorites, toggleFavorite, isFavorite } = useFavoritePages();

  const getInitialOpen = useCallback(() => {
    const openSet = new Set<number>();
    navGroups.forEach((group, idx) => {
      const hasActive = group.items.some((item) =>
        item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
      );
      if (hasActive) openSet.add(idx);
    });
    return openSet;
  }, []);

  const [openGroups, setOpenGroups] = useState<Set<number>>(getInitialOpen);

  const toggleGroup = (idx: number) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const quickAccessPaths = [
    '/dashboard',
    '/dashboard/operations',
    '/dashboard/tickets',
    '/dashboard/commands',
  ];
  const quickAccessItems = getAllNavItems().filter((item) => quickAccessPaths.includes(item.to));

  // Find favorite nav items
  const favoriteItems = favorites
    .map((path) => {
      for (const group of navGroups) {
        const item = group.items.find((i) => i.to === path);
        if (item) return item;
      }
      return null;
    })
    .filter(Boolean);

  const renderNavItem = (item: typeof navGroups[0]['items'][0], showFavStar = false) => {
    const isActive = item.end
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to);
    const premiumKey = PREMIUM_NAV_MAP[item.to];
    const isPremium = !!premiumKey;
    const hasAccess = !isPremium || hasPremiumFeature(premiumKey);

    return (
      <div key={item.to} className="group relative flex items-center">
        <NavLink
          to={item.to as any}
          onClick={onNavigate}
          className={cn(
            'flex flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-all',
            isActive
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{t(item.labelKey)}</span>
          {isPremium && !hasAccess && (
            <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          {isPremium && hasAccess && (
            <Crown className="h-3 w-3 text-amber-500 shrink-0" />
          )}
        </NavLink>
        {/* Favorite toggle */}
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleFavorite(item.to);
          }}
          className={cn(
            'absolute right-1 p-1 rounded transition-opacity',
            isFavorite(item.to)
              ? 'opacity-100 text-amber-500'
              : 'opacity-0 group-hover:opacity-60 text-muted-foreground hover:text-amber-500'
          )}
          title={isFavorite(item.to)
            ? (language === 'da' ? 'Fjern fra favoritter' : 'Remove from favorites')
            : (language === 'da' ? 'Tilføj til favoritter' : 'Add to favorites')}
        >
          <Star className={cn('h-3 w-3', isFavorite(item.to) && 'fill-current')} />
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo with Bot Status */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg gradient-blurple">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-sidebar-foreground">GuildOS Bot</span>
        </div>
        <BotStatusIndicator />
      </div>

      {/* Guild Selector */}
      {selectedGuild && (
        <div className="border-b border-sidebar-border p-4">
          <NavLink
            to={"/guilds" as any}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-sidebar-accent"
          >
            <Avatar className="h-10 w-10">
              {selectedGuild.guild_icon ? (
                <AvatarImage
                  src={`https://cdn.discordapp.com/icons/${selectedGuild.guild_id}/${selectedGuild.guild_icon}.png`}
                  alt={selectedGuild.guild_name}
                />
              ) : null}
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {selectedGuild.guild_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {selectedGuild.guild_name}
              </p>
              <p className="text-xs text-muted-foreground">{t('nav.switchServer')}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </NavLink>
        </div>
      )}

      {/* Search */}
      <div className="p-3 pb-0">
        <CommandPalette />
      </div>

      {/* Grouped Navigation */}
      <ScrollArea className="flex-1">
        <nav className="space-y-1 p-3">
          <div className="mb-3">
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {language === 'da' ? 'Hurtig adgang' : 'Quick access'}
            </p>
            <div className="space-y-0.5">
              {quickAccessItems.map((item) => renderNavItem(item))}
            </div>
            <div className="my-3 border-b border-sidebar-border" />
          </div>

          {/* Favorites section */}
          {favoriteItems.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {language === 'da' ? '⭐ Favoritter' : '⭐ Favorites'}
              </p>
              <div className="space-y-0.5">
                {favoriteItems.map((item) => item && renderNavItem(item, true))}
              </div>
              <div className="my-2 border-b border-sidebar-border" />
            </div>
          )}

          {navGroups.map((group, groupIdx) => {
            const isOpen = openGroups.has(groupIdx);
            const groupLabel = language === 'da' ? group.labelDa : group.labelEn;
            const hasActiveItem = group.items.some((item) =>
              item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
            );

            return (
              <Collapsible key={groupIdx} open={isOpen} onOpenChange={() => toggleGroup(groupIdx)}>
                <CollapsibleTrigger className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                  'text-sidebar-foreground hover:bg-sidebar-accent',
                  hasActiveItem && !isOpen && 'text-primary'
                )}>
                  <group.icon className={cn('h-4 w-4', hasActiveItem && 'text-primary')} />
                  <span className="flex-1 text-left">{groupLabel}</span>
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                    {group.items.map((item) => renderNavItem(item))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Menu */}
      <div className="border-t border-sidebar-border p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-sidebar-accent">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/20 text-primary">
                {user?.email?.slice(0, 2).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden text-left">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-xs text-muted-foreground">{t('nav.administrator')}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => navigate({ to: '/dashboard/bot-settings' })}
            >
              <Settings className="mr-2 h-4 w-4" />
              {t('common.settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLanguage(language === 'da' ? 'en' : 'da')} className="cursor-pointer">
              <Globe className="mr-2 h-4 w-4" />
              {language === 'da' ? '🇬🇧 English' : '🇩🇰 Dansk'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="cursor-pointer">
              {theme === 'dark' ? (
                <Sun className="mr-2 h-4 w-4" />
              ) : (
                <Moon className="mr-2 h-4 w-4" />
              )}
              {theme === 'dark' ? t('nav.lightTheme') : t('nav.darkTheme')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {t('nav.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
