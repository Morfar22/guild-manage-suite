import { useCommands } from '@/hooks/useCommands';
import { useLanguage } from '@/contexts/LanguageContext';
import { CommandTable } from '@/components/dashboard/CommandTable';
import { COMMANDS_BY_CATEGORY, CommandCategory } from '@/types/discord';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Music, TrendingUp, Wrench, Gamepad2, ToggleLeft, ToggleRight, Coins, Ticket, Gift, Settings, Smile, ShoppingCart, HelpCircle } from 'lucide-react';

const categoryIcons: Record<string, React.ElementType> = {
  moderation: Shield, music: Music, leveling: TrendingUp, utility: Wrench, fun: Gamepad2,
  economy: Coins, tickets: Ticket, giveaway: Gift, tebex: ShoppingCart, admin: Settings, reactionroles: Smile,
};

const getIcon = (category: string): React.ElementType => categoryIcons[category] || HelpCircle;

const categoryDescriptions: Record<string, Record<string, string>> = {
  moderation: { da: 'Kommandoer til at administrere og moderere dine servermedlemmer', en: 'Commands to manage and moderate your server members' },
  music: { da: 'Afspil og kontroller musik fra forskellige kilder', en: 'Play and control music from various sources' },
  leveling: { da: 'XP-system, ranglister og niveau-baserede belønninger', en: 'XP system, leaderboards and level-based rewards' },
  utility: { da: 'Nyttige værktøjer og serverinformation', en: 'Useful tools and server information' },
  fun: { da: 'Spil, underholdning og sjove interaktioner', en: 'Games, entertainment and fun interactions' },
  economy: { da: 'Virtuel valuta, shop og handelskommandoer', en: 'Virtual currency, shop and trade commands' },
  tickets: { da: 'Support ticket-system og administration', en: 'Support ticket system and management' },
  giveaway: { da: 'Opret og administrer giveaways', en: 'Create and manage giveaways' },
  tebex: { da: 'Verificer Tebex-køb', en: 'Verify Tebex purchases' },
  admin: { da: 'Server-opsætning og konfigurationskommandoer', en: 'Server setup and configuration commands' },
  reactionroles: { da: 'Reaction role panel administration', en: 'Reaction role panel management' },
};

export default function Commands() {
  const { enabledCommands, loading, updating, toggleCommand, toggleCategory, getCategoryStats } = useCommands();
  const { language } = useLanguage();
  const en = language === 'en';

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const categories = Object.keys(COMMANDS_BY_CATEGORY) as CommandCategory[];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{en ? 'Commands' : 'Kommandoer'}</h1>
        <p className="mt-1 text-muted-foreground">{en ? 'Enable or disable individual commands for your server' : 'Aktiver eller deaktiver individuelle kommandoer for din server'}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {categories.map((category) => {
          const stats = getCategoryStats(category);
          const Icon = getIcon(category);
          return (
            <div key={category} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm font-medium capitalize text-foreground">{category}</p>
                <p className="text-xs text-muted-foreground">{stats.enabled}/{stats.total} {en ? 'active' : 'aktive'}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="moderation" className="space-y-6">
        <TabsList className="bg-muted border border-border h-auto flex-wrap gap-1 p-1">
          {categories.map((category) => {
            const Icon = getIcon(category);
            const stats = getCategoryStats(category);
            return (
              <TabsTrigger key={category} value={category} className="flex items-center gap-2 capitalize data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Icon className="h-4 w-4" />{category}
                <Badge variant={stats.allEnabled ? "default" : stats.noneEnabled ? "destructive" : "secondary"} className="ml-1 text-xs">{stats.enabled}/{stats.total}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {categories.map((category) => {
          const stats = getCategoryStats(category);
          return (
            <TabsContent key={category} value={category} className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold capitalize text-foreground">{category} {en ? 'Commands' : 'Kommandoer'}</h2>
                  <p className="text-sm text-muted-foreground">{categoryDescriptions[category]?.[language] || ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleCategory(category, true)} disabled={updating || stats.allEnabled} className="text-xs">
                    <ToggleRight className="mr-1 h-3 w-3" />{en ? 'Enable all' : 'Aktiver alle'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleCategory(category, false)} disabled={updating || stats.noneEnabled} className="text-xs">
                    <ToggleLeft className="mr-1 h-3 w-3" />{en ? 'Disable all' : 'Deaktiver alle'}
                  </Button>
                </div>
              </div>
              <CommandTable commands={COMMANDS_BY_CATEGORY[category]} enabledCommands={enabledCommands} onToggle={toggleCommand} loading={updating} />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
