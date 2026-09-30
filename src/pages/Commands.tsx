import { useMemo, useState } from 'react';
import { useCommands } from '@/hooks/useCommands';
import { useLanguage } from '@/contexts/LanguageContext';
import { CommandTable } from '@/components/dashboard/CommandTable';
import { CommandSettingsDialog } from '@/components/dashboard/CommandSettingsDialog';
import { CommandDetailDialog } from '@/components/dashboard/CommandDetailDialog';
import { CommandAnalyticsPanel } from '@/components/dashboard/CommandAnalyticsPanel';
import { CommandPermissionsMatrix } from '@/components/dashboard/CommandPermissionsMatrix';
import { COMMANDS_BY_CATEGORY, CommandCategory, CommandInfo } from '@/types/discord';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  Loader2,
  Shield,
  ShieldCheck,
  Music,
  TrendingUp,
  Wrench,
  Gamepad2,
  ToggleLeft,
  ToggleRight,
  Coins,
  Ticket,
  Gift,
  Settings,
  Smile,
  ShoppingCart,
  HelpCircle,
  Search,
  SlidersHorizontal,
  Command as CommandIcon,
} from 'lucide-react';

const categoryIcons: Record<string, React.ElementType> = {
  moderation: Shield,
  music: Music,
  leveling: TrendingUp,
  utility: Wrench,
  fun: Gamepad2,
  economy: Coins,
  tickets: Ticket,
  giveaway: Gift,
  tebex: ShoppingCart,
  admin: Settings,
  reactionroles: Smile,
};

const getIcon = (category: string): React.ElementType => categoryIcons[category] || HelpCircle;

const categoryDescriptions: Record<string, Record<string, string>> = {
  moderation: { da: 'Administration og moderation af servermedlemmer', en: 'Server member management and moderation' },
  music: { da: 'Afspil og kontrollér musik', en: 'Play and control music' },
  leveling: { da: 'XP, ranglister og level-belønninger', en: 'XP, leaderboards and level rewards' },
  utility: { da: 'Serverværktøjer og information', en: 'Server tools and information' },
  fun: { da: 'Spil og underholdning', en: 'Games and entertainment' },
  economy: { da: 'Valuta, shop og økonomi', en: 'Currency, shop and economy' },
  tickets: { da: 'Ticket-system og support', en: 'Ticket system and support' },
  giveaway: { da: 'Giveaways og vindere', en: 'Giveaways and winners' },
  tebex: { da: 'Tebex-verifikation', en: 'Tebex verification' },
  admin: { da: 'Serveropsætning og administration', en: 'Server setup and administration' },
  reactionroles: { da: 'Reaction role-paneler', en: 'Reaction role panels' },
};

type StatusFilter = 'all' | 'enabled' | 'disabled' | 'restricted';

export default function Commands() {
  const {
    commandSettings,
    loading,
    updating,
    toggleCommand,
    updateCommandSettings,
    bulkUpdateCommands,
    copyCommandRules,
    toggleCategory,
    getCategoryStats,
  } = useCommands();
  const { language } = useLanguage();
  const en = language === 'en';

  const [section, setSection] = useState('control');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedCommand, setSelectedCommand] = useState<CommandInfo | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailCommand, setDetailCommand] = useState<CommandInfo | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const categories = Object.keys(COMMANDS_BY_CATEGORY) as CommandCategory[];
  const allCommands = useMemo(() => Object.values(COMMANDS_BY_CATEGORY).flat(), []);

  const filterCommands = (commands: CommandInfo[]) => {
    const normalized = query.trim().toLowerCase();

    return commands.filter((command) => {
      const settings = commandSettings[command.name];
      const enabled = settings?.enabled !== false;
      const restricted =
        (settings?.cooldown_seconds ?? 0) > 0 ||
        (settings?.allowed_role_ids?.length ?? 0) > 0 ||
        (settings?.allowed_channel_ids?.length ?? 0) > 0;

      if (normalized) {
        const haystack = `${command.name} ${command.description} ${command.category} ${command.usage}`.toLowerCase();
        if (!haystack.includes(normalized)) return false;
      }

      if (statusFilter === 'enabled' && !enabled) return false;
      if (statusFilter === 'disabled' && enabled) return false;
      if (statusFilter === 'restricted' && !restricted) return false;
      return true;
    });
  };

  const filteredAll = filterCommands(allCommands);
  const totalEnabled = allCommands.filter((command) => commandSettings[command.name]?.enabled !== false).length;
  const totalRestricted = allCommands.filter((command) => {
    const settings = commandSettings[command.name];
    return (
      (settings?.cooldown_seconds ?? 0) > 0 ||
      (settings?.allowed_role_ids?.length ?? 0) > 0 ||
      (settings?.allowed_channel_ids?.length ?? 0) > 0
    );
  }).length;

  const openSettings = (command: CommandInfo) => {
    setSelectedCommand(command);
    setSettingsOpen(true);
  };

  const openDetail = (command: CommandInfo) => {
    setDetailCommand(command);
    setDetailOpen(true);
  };

  const openDetailByName = (commandName: string) => {
    const command = allCommands.find((item) => item.name === commandName);
    if (command) openDetail(command);
  };

  const editFromDetail = (command: CommandInfo) => {
    setDetailOpen(false);
    openSettings(command);
  };

  const jumpToCategory = (category: string) => {
    setSection('control');
    setActiveCategory(category);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-7 animate-fade-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-primary">
            <CommandIcon className="h-4 w-4" />
            Command Center V2.1
          </div>
          <h1 className="text-3xl font-bold text-foreground">Command Center</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            {en
              ? 'Control commands, access rules, cooldowns and execution analytics from one place.'
              : 'Styr commands, adgangsregler, cooldowns og execution analytics fra ét sted.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="px-3 py-1.5">
            {totalEnabled}/{allCommands.length} {en ? 'active' : 'aktive'}
          </Badge>
          <Badge variant="outline" className="px-3 py-1.5">
            {totalRestricted} {en ? 'with rules' : 'med regler'}
          </Badge>
        </div>
      </div>

      <Tabs value={section} onValueChange={setSection} className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1 border border-border bg-muted p-1">
          <TabsTrigger value="control" className="gap-2">
            <CommandIcon className="h-4 w-4" />
            {en ? 'Commands' : 'Commands'}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {categories.map((category) => {
              const stats = getCategoryStats(category);
              const Icon = getIcon(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => jumpToCategory(category)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium capitalize text-foreground">{category}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.enabled}/{stats.total} {en ? 'active' : 'aktive'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={en ? 'Search command, description or usage...' : 'Søg efter command, beskrivelse eller brug...'}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{en ? 'All statuses' : 'Alle statusser'}</SelectItem>
                  <SelectItem value="enabled">{en ? 'Enabled' : 'Aktive'}</SelectItem>
                  <SelectItem value="disabled">{en ? 'Disabled' : 'Deaktiverede'}</SelectItem>
                  <SelectItem value="restricted">{en ? 'With restrictions' : 'Med begrænsninger'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="space-y-5">
            <TabsList className="h-auto flex-wrap gap-1 border border-border bg-muted p-1">
              <TabsTrigger value="all" className="gap-2">
                <CommandIcon className="h-4 w-4" />
                {en ? 'All' : 'Alle'}
                <Badge variant="secondary" className="ml-1 text-xs">{filteredAll.length}</Badge>
              </TabsTrigger>
              {categories.map((category) => {
                const Icon = getIcon(category);
                const stats = getCategoryStats(category);
                return (
                  <TabsTrigger key={category} value={category} className="flex items-center gap-2 capitalize">
                    <Icon className="h-4 w-4" />
                    {category}
                    <Badge variant={stats.allEnabled ? 'default' : stats.noneEnabled ? 'destructive' : 'secondary'} className="ml-1 text-xs">
                      {stats.enabled}/{stats.total}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{en ? 'All commands' : 'Alle commands'}</h2>
                <p className="text-sm text-muted-foreground">
                  {filteredAll.length} {en ? 'commands match your filters' : 'commands matcher dine filtre'}
                </p>
              </div>
              <CommandTable
                commands={filteredAll}
                commandSettings={commandSettings}
                onToggle={toggleCommand}
                onConfigure={openSettings}
                onInspect={openDetail}
                loading={updating}
              />
            </TabsContent>

            {categories.map((category) => {
              const stats = getCategoryStats(category);
              const commands = filterCommands(COMMANDS_BY_CATEGORY[category]);
              return (
                <TabsContent key={category} value={category} className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold capitalize text-foreground">
                        {category} commands
                      </h2>
                      <p className="text-sm text-muted-foreground">{categoryDescriptions[category]?.[language] || ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleCategory(category, true)}
                        disabled={updating || stats.allEnabled}
                      >
                        <ToggleRight className="mr-1 h-3.5 w-3.5" />
                        {en ? 'Enable all' : 'Aktiver alle'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleCategory(category, false)}
                        disabled={updating || stats.noneEnabled}
                      >
                        <ToggleLeft className="mr-1 h-3.5 w-3.5" />
                        {en ? 'Disable all' : 'Deaktiver alle'}
                      </Button>
                    </div>
                  </div>

                  <CommandTable
                    commands={commands}
                    commandSettings={commandSettings}
                    onToggle={toggleCommand}
                    onConfigure={openSettings}
                    onInspect={openDetail}
                    loading={updating}
                  />
                </TabsContent>
              );
            })}
          </Tabs>
        </TabsContent>

        <TabsContent value="analytics">
          <CommandAnalyticsPanel onInspect={openDetailByName} />
        </TabsContent>

        <TabsContent value="permissions">
          <CommandPermissionsMatrix
            commandSettings={commandSettings}
            updating={updating}
            onUpdateCommand={updateCommandSettings}
            onBulkUpdate={bulkUpdateCommands}
            onCopyRules={copyCommandRules}
          />
        </TabsContent>
      </Tabs>

      {detailCommand && (
        <CommandDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          command={detailCommand}
          settings={commandSettings[detailCommand.name]}
          updating={updating}
          onToggle={toggleCommand}
          onEditSettings={editFromDetail}
        />
      )}

      <CommandSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        command={selectedCommand}
        settings={selectedCommand ? commandSettings[selectedCommand.name] : undefined}
        saving={updating}
        onSave={updateCommandSettings}
      />
    </div>
  );
}
