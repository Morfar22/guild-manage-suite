import { useState } from 'react';
import { TicketPanel, PanelInput, OperatingHours } from '@/hooks/useTicketPanels';
import { useTicketCategories } from '@/hooks/useTickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ChannelSelect } from '@/components/ui/channel-select';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DialogFooter } from '@/components/ui/dialog';
import { Clock, Palette, Layout, Filter } from 'lucide-react';

interface PanelEditorProps {
  initial?: Partial<TicketPanel>;
  onSubmit: (input: PanelInput) => void | Promise<void>;
  isLoading?: boolean;
}

const DAYS: Array<{ key: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'; label: string }> = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const defaultDay = { enabled: true, open: '09:00', close: '17:00' };

function toHex(int: number) {
  return '#' + int.toString(16).padStart(6, '0');
}
function fromHex(hex: string) {
  return parseInt(hex.replace('#', ''), 16) || 0;
}

export default function PanelEditor({ initial, onSubmit, isLoading }: PanelEditorProps) {
  const { data: categories } = useTicketCategories();

  const [form, setForm] = useState<PanelInput>({
    name: initial?.name ?? 'Main Panel',
    channel_id: initial?.channel_id ?? null,
    embed_title: initial?.embed_title ?? '🎫 Support Tickets',
    embed_description: initial?.embed_description ?? 'Select a category below to create a ticket.',
    embed_color: initial?.embed_color ?? 5793266,
    embed_image_url: initial?.embed_image_url ?? null,
    embed_thumbnail_url: initial?.embed_thumbnail_url ?? null,
    embed_footer_text: initial?.embed_footer_text ?? null,
    component_style: initial?.component_style ?? 'select',
    button_label: initial?.button_label ?? 'Open Ticket',
    button_emoji: initial?.button_emoji ?? '📩',
    button_style: initial?.button_style ?? 1,
    category_ids: initial?.category_ids ?? [],
    enabled: initial?.enabled ?? true,
    operating_hours: initial?.operating_hours ?? { enabled: false },
  });

  const update = <K extends keyof PanelInput>(k: K, v: PanelInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const updateHours = (patch: Partial<OperatingHours>) =>
    setForm((f) => ({ ...f, operating_hours: { ...(f.operating_hours || { enabled: false }), ...patch } }));

  const updateDay = (dayKey: string, patch: Partial<{ enabled: boolean; open: string; close: string }>) => {
    const hours = form.operating_hours || { enabled: false };
    const days = { ...(hours.days || {}) } as any;
    days[dayKey] = { ...(days[dayKey] || defaultDay), ...patch };
    updateHours({ days });
  };

  const toggleCategory = (id: string) => {
    const list = form.category_ids || [];
    update('category_ids', list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const support = (categories || []).filter((c) => c.ticket_type === 'support');
  const hours = form.operating_hours || { enabled: false };

  return (
    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
      {/* Basics */}
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Panel name</Label>
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Support Panel" />
          </div>
          <div className="space-y-2">
            <Label>Channel</Label>
            <ChannelSelect value={form.channel_id || ''} onValueChange={(v) => update('channel_id', v || null)} placeholder="Where the panel is posted" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.enabled} onCheckedChange={(v) => update('enabled', v)} id="pnl-enabled" />
          <Label htmlFor="pnl-enabled">Panel enabled</Label>
        </div>
      </div>

      <Separator />

      {/* Embed customizer */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium"><Palette className="h-4 w-4" /> Embed appearance</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={form.embed_title || ''} onChange={(e) => update('embed_title', e.target.value)} maxLength={256} />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={toHex(form.embed_color || 0)} onChange={(e) => update('embed_color', fromHex(e.target.value))} className="h-10 w-16 rounded border border-border cursor-pointer" />
              <Input value={toHex(form.embed_color || 0)} onChange={(e) => update('embed_color', fromHex(e.target.value))} className="flex-1" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={form.embed_description || ''} onChange={(e) => update('embed_description', e.target.value)} rows={3} maxLength={4000} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Thumbnail URL</Label>
            <Input value={form.embed_thumbnail_url || ''} onChange={(e) => update('embed_thumbnail_url', e.target.value || null)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input value={form.embed_image_url || ''} onChange={(e) => update('embed_image_url', e.target.value || null)} placeholder="https://..." />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Footer</Label>
          <Input value={form.embed_footer_text || ''} onChange={(e) => update('embed_footer_text', e.target.value || null)} maxLength={2048} />
        </div>
      </div>

      <Separator />

      {/* Components */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium"><Layout className="h-4 w-4" /> Components</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Style</Label>
            <Select value={form.component_style} onValueChange={(v) => update('component_style', v as 'select' | 'buttons')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="select">Dropdown select menu</SelectItem>
                <SelectItem value="buttons">Buttons (1 per category)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.component_style === 'buttons' && (
            <div className="space-y-2">
              <Label>Button color</Label>
              <Select value={String(form.button_style ?? 1)} onValueChange={(v) => update('button_style', parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Blurple</SelectItem>
                  <SelectItem value="2">Grey</SelectItem>
                  <SelectItem value="3">Green</SelectItem>
                  <SelectItem value="4">Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Category filter */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4" /> Categories in this panel</div>
        <p className="text-xs text-muted-foreground">Leave empty to include all support categories.</p>
        <div className="flex flex-wrap gap-2">
          {support.length === 0 && <p className="text-xs text-muted-foreground italic">No support categories yet.</p>}
          {support.map((c) => {
            const selected = (form.category_ids || []).includes(c.id);
            return (
              <Badge
                key={c.id}
                variant={selected ? 'default' : 'outline'}
                className="cursor-pointer select-none"
                onClick={() => toggleCategory(c.id)}
              >
                {c.emoji} {c.name}
              </Badge>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Operating hours */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4" /> Operating hours</div>
          <div className="flex items-center gap-2">
            <Switch checked={hours.enabled} onCheckedChange={(v) => updateHours({ enabled: v })} id="oh" />
            <Label htmlFor="oh" className="text-xs">Enabled</Label>
          </div>
        </div>
        {hours.enabled && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Timezone (IANA, e.g. Europe/Copenhagen)</Label>
                <Input value={hours.timezone || 'Europe/Copenhagen'} onChange={(e) => updateHours({ timezone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Closed message</Label>
                <Input value={hours.closed_message || ''} onChange={(e) => updateHours({ closed_message: e.target.value })} placeholder="We're closed. Please try again later." />
              </div>
            </div>
            <div className="space-y-1.5">
              {DAYS.map((d) => {
                const dv = hours.days?.[d.key] || defaultDay;
                return (
                  <div key={d.key} className="flex items-center gap-2 text-sm">
                    <Switch checked={dv.enabled} onCheckedChange={(v) => updateDay(d.key, { enabled: v })} />
                    <span className="w-10 text-muted-foreground">{d.label}</span>
                    <Input type="time" value={dv.open} onChange={(e) => updateDay(d.key, { open: e.target.value })} className="w-28" disabled={!dv.enabled} />
                    <span className="text-muted-foreground">–</span>
                    <Input type="time" value={dv.close} onChange={(e) => updateDay(d.key, { close: e.target.value })} className="w-28" disabled={!dv.enabled} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="sticky bottom-0 bg-background pt-4">
        <Button onClick={() => onSubmit(form)} disabled={isLoading || !form.name}>
          {isLoading ? 'Saving...' : 'Save panel'}
        </Button>
      </DialogFooter>
    </div>
  );
}
