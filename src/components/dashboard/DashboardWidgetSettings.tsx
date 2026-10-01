import { useEffect, useState } from 'react';
import { LayoutDashboard, SlidersHorizontal } from 'lucide-react';
import {
  DEFAULT_DASHBOARD_WIDGETS,
  DashboardWidgetId,
  useDashboardPreferences,
} from '@/hooks/useDashboardPreferences';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

const LABELS: Record<DashboardWidgetId, string> = {
  operations: 'Operations Pulse',
  bot_status: 'Bot status',
  activity: 'Aktivitet & fordeling',
  growth: 'Medlemsvækst & moderation',
  server_stats: 'Server stats & quick actions',
  recent_activity: 'Config & seneste aktivitet',
};

export function DashboardWidgetSettings() {
  const prefs = useDashboardPreferences();
  const [open, setOpen] = useState(false);
  const [widgets, setWidgets] = useState<string[]>(prefs.widgets);
  const [compact, setCompact] = useState(prefs.compactMode);

  useEffect(() => {
    setWidgets(prefs.widgets);
    setCompact(prefs.compactMode);
  }, [prefs.widgets, prefs.compactMode]);

  const toggle = (id: string) => {
    setWidgets((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const save = () => {
    prefs.save.mutate(
      { widgets, compactMode: compact },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Tilpas dashboard
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            Dashboard widgets
          </DialogTitle>
          <DialogDescription>
            Layoutet gemmes pr. bruger og server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {DEFAULT_DASHBOARD_WIDGETS.map((id) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/30"
            >
              <Checkbox checked={widgets.includes(id)} onCheckedChange={() => toggle(id)} />
              <span className="text-sm font-medium">{LABELS[id]}</span>
            </label>
          ))}
        </div>

        <label className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">Compact mode</div>
            <div className="text-xs text-muted-foreground">Mindre spacing på dashboardet.</div>
          </div>
          <Switch checked={compact} onCheckedChange={setCompact} />
        </label>

        <div className="flex justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setWidgets([...DEFAULT_DASHBOARD_WIDGETS]);
              setCompact(false);
            }}
          >
            Reset
          </Button>
          <Button onClick={save} disabled={prefs.save.isPending}>Gem layout</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
