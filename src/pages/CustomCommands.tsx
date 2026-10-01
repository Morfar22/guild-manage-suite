import { useState } from 'react';
import {
  BarChart3,
  Hash,
  Layers3,
  Loader2,
  LockKeyhole,
  MousePointerClick,
  Plus,
  ShieldCheck,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCustomCommands, CreateCustomCommand } from '@/hooks/useCustomCommands';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type ButtonDraft = {
  label: string;
  style: 'primary' | 'secondary' | 'success' | 'danger' | 'link';
  response: string;
  url: string;
};

const emptyForm = (): CreateCustomCommand => ({
  name: '',
  trigger: '',
  trigger_type: 'command',
  response_type: 'text',
  response_content: '',
  cooldown_seconds: 0,
  description: '',
  allowed_role_ids: [],
  blocked_role_ids: [],
  allowed_channels: [],
  blocked_channel_ids: [],
  conditions: {},
  response_buttons: [],
  response_selects: [],
});

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function CustomCommands() {
  const { commands, isLoading, createCommand, updateCommand, deleteCommand } = useCustomCommands();
  const { data: roles = [] } = useDiscordRoles();
  const { data: channelData } = useDiscordChannels();
  const channels = channelData?.channels ?? [];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateCustomCommand>(emptyForm());
  const [embedTitle, setEmbedTitle] = useState('');
  const [embedDescription, setEmbedDescription] = useState('');
  const [embedColor, setEmbedColor] = useState('#5865F2');
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);
  const [selectPlaceholder, setSelectPlaceholder] = useState('Vælg en mulighed');
  const [selectOptions, setSelectOptions] = useState('');

  const resetBuilder = () => {
    setForm(emptyForm());
    setEmbedTitle('');
    setEmbedDescription('');
    setEmbedColor('#5865F2');
    setButtons([]);
    setSelectPlaceholder('Vælg en mulighed');
    setSelectOptions('');
  };

  const handleCreate = () => {
    if (!form.name || !form.trigger) return;

    const parsedSelectOptions = selectOptions
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [label, value, response] = line.split('|').map((part) => part?.trim());
        return {
          label: label || `Option ${index + 1}`,
          value: value || String(index + 1),
          response: response || undefined,
        };
      })
      .slice(0, 25);

    const payload: CreateCustomCommand = {
      ...form,
      response_embed: form.response_type === 'embed'
        ? {
            title: embedTitle || undefined,
            description: embedDescription || form.response_content || undefined,
            color: embedColor || undefined,
          }
        : undefined,
      response_buttons: buttons
        .filter((button) => button.label.trim())
        .map((button) => ({
          label: button.label.trim(),
          style: button.style,
          response: button.response || undefined,
          url: button.style === 'link' ? button.url || undefined : undefined,
        })),
      response_selects: parsedSelectOptions.length
        ? [{
            placeholder: selectPlaceholder || 'Vælg en mulighed',
            min_values: 1,
            max_values: 1,
            options: parsedSelectOptions,
          }]
        : [],
    };

    createCommand.mutate(payload, {
      onSuccess: () => {
        setOpen(false);
        resetBuilder();
      },
    });
  };

  const addButton = () => {
    if (buttons.length >= 5) return;
    setButtons((current) => [
      ...current,
      { label: '', style: 'primary', response: '', url: '' },
    ]);
  };

  const updateButton = (index: number, updates: Partial<ButtonDraft>) => {
    setButtons((current) => current.map((button, buttonIndex) =>
      buttonIndex === index ? { ...button, ...updates } : button
    ));
  };

  const triggerTypeLabels: Record<string, string> = {
    command: 'Kommando',
    keyword: 'Nøgleord',
    startswith: 'Starter med',
  };

  const responseTypeLabels: Record<string, string> = {
    text: 'Tekst',
    embed: 'Embed',
    role_toggle: 'Rolle toggle',
    random: 'Tilfældig',
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allowedRoles = form.allowed_role_ids ?? [];
  const blockedRoles = form.blocked_role_ids ?? [];
  const allowedChannels = form.allowed_channels ?? [];
  const blockedChannels = form.blocked_channel_ids ?? [];
  const conditions = form.conditions ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Layers3 className="h-4 w-4" />
            Command Builder V2
          </div>
          <h1 className="text-3xl font-bold">Custom Commands</h1>
          <p className="text-muted-foreground">
            Byg commands med adgangsregler, conditions, embeds, buttons og select menus uden kode.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Ny command</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Byg custom command</DialogTitle>
              <DialogDescription>
                Trigger, adgang, svar og interaktioner konfigureres i én builder.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="space-y-5">
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="access">Access & Conditions</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
                <TabsTrigger value="components">Buttons & Select</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Navn</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Regler" />
                  </div>
                  <div className="space-y-2">
                    <Label>Trigger</Label>
                    <Input value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} placeholder="!regler" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Beskrivelse</Label>
                  <Input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Trigger type</Label>
                    <Select value={form.trigger_type} onValueChange={(value) => setForm({ ...form, trigger_type: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="command">Command</SelectItem>
                        <SelectItem value="keyword">Keyword</SelectItem>
                        <SelectItem value="startswith">Starts with</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Cooldown</Label>
                    <Input
                      type="number"
                      min={0}
                      max={86400}
                      value={form.cooldown_seconds ?? 0}
                      onChange={(e) => setForm({ ...form, cooldown_seconds: Number(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Response type</Label>
                    <Select value={form.response_type} onValueChange={(value) => setForm({ ...form, response_type: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="embed">Embed</SelectItem>
                        <SelectItem value="role_toggle">Role toggle</SelectItem>
                        <SelectItem value="random">Random</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.response_type === 'role_toggle' && (
                  <div className="space-y-2">
                    <Label>Rolle der toggles</Label>
                    <Select value={form.role_id ?? ''} onValueChange={(role_id) => setForm({ ...form, role_id })}>
                      <SelectTrigger><SelectValue placeholder="Vælg rolle" /></SelectTrigger>
                      <SelectContent>
                        {roles.filter((role) => role.name !== '@everyone').map((role) => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="access" className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <AccessList
                    title="Tilladte roller"
                    description="Tom liste = alle roller."
                    items={roles.filter((role) => role.name !== '@everyone').map((role) => ({ id: role.id, label: role.name }))}
                    values={allowedRoles}
                    onToggle={(id) => setForm({ ...form, allowed_role_ids: toggle(allowedRoles, id) })}
                  />
                  <AccessList
                    title="Blokerede roller"
                    description="Har brugeren en af disse roller, blokeres commanden."
                    items={roles.filter((role) => role.name !== '@everyone').map((role) => ({ id: role.id, label: role.name }))}
                    values={blockedRoles}
                    onToggle={(id) => setForm({ ...form, blocked_role_ids: toggle(blockedRoles, id) })}
                  />
                  <AccessList
                    title="Tilladte kanaler"
                    description="Tom liste = alle kanaler."
                    items={channels.map((channel) => ({ id: channel.id, label: `#${channel.name}` }))}
                    values={allowedChannels}
                    onToggle={(id) => setForm({ ...form, allowed_channels: toggle(allowedChannels, id) })}
                  />
                  <AccessList
                    title="Blokerede kanaler"
                    description="Disse kanaler afvises altid."
                    items={channels.map((channel) => ({ id: channel.id, label: `#${channel.name}` }))}
                    values={blockedChannels}
                    onToggle={(id) => setForm({ ...form, blocked_channel_ids: toggle(blockedChannels, id) })}
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Conditions</CardTitle>
                    <CardDescription>Ekstra betingelser der skal være opfyldt.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Min. account age (dage)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={Number(conditions.min_account_age_days ?? 0)}
                        onChange={(e) => setForm({
                          ...form,
                          conditions: { ...conditions, min_account_age_days: Number(e.target.value) || 0 },
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Min. member age (dage)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={Number(conditions.min_member_age_days ?? 0)}
                        onChange={(e) => setForm({
                          ...form,
                          conditions: { ...conditions, min_member_age_days: Number(e.target.value) || 0 },
                        })}
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-3 rounded-lg border p-3">
                        <Switch
                          checked={Boolean(conditions.require_nsfw)}
                          onCheckedChange={(checked) => setForm({
                            ...form,
                            conditions: { ...conditions, require_nsfw: checked },
                          })}
                        />
                        <span className="text-sm">Kun NSFW-kanaler</span>
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="response" className="space-y-4">
                {form.response_type === 'embed' ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-[1fr_160px]">
                      <div className="space-y-2">
                        <Label>Embed title</Label>
                        <Input value={embedTitle} onChange={(e) => setEmbedTitle(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Farve</Label>
                        <Input type="color" value={embedColor} onChange={(e) => setEmbedColor(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Embed description</Label>
                      <Textarea value={embedDescription} onChange={(e) => setEmbedDescription(e.target.value)} rows={7} />
                    </div>
                  </>
                ) : form.response_type === 'random' ? (
                  <div className="space-y-2">
                    <Label>Tilfældige svar, ét pr. linje</Label>
                    <Textarea
                      rows={8}
                      value={(form.response_options ?? []).join('\n')}
                      onChange={(e) => setForm({
                        ...form,
                        response_options: e.target.value.split('\n').filter(Boolean),
                      })}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Svar</Label>
                    <Textarea
                      value={form.response_content ?? ''}
                      onChange={(e) => setForm({ ...form, response_content: e.target.value })}
                      placeholder="Brug {user}, {username}, {server}, {channel}, {membercount}"
                      rows={8}
                    />
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Placeholders: {'{user}'} {'{username}'} {'{server}'} {'{channel}'} {'{membercount}'}
                </p>
              </TabsContent>

              <TabsContent value="components" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <MousePointerClick className="h-4 w-4" />
                          Buttons
                        </CardTitle>
                        <CardDescription>Op til fem buttons på command-svaret.</CardDescription>
                      </div>
                      <Button size="sm" variant="outline" onClick={addButton} disabled={buttons.length >= 5}>
                        <Plus className="mr-1 h-4 w-4" />Button
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {buttons.map((button, index) => (
                      <div key={index} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_150px_1fr_auto]">
                        <Input
                          value={button.label}
                          onChange={(e) => updateButton(index, { label: e.target.value })}
                          placeholder="Label"
                        />
                        <Select value={button.style} onValueChange={(style) => updateButton(index, { style: style as ButtonDraft['style'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="primary">Primary</SelectItem>
                            <SelectItem value="secondary">Secondary</SelectItem>
                            <SelectItem value="success">Success</SelectItem>
                            <SelectItem value="danger">Danger</SelectItem>
                            <SelectItem value="link">Link</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={button.style === 'link' ? button.url : button.response}
                          onChange={(e) => updateButton(index, button.style === 'link' ? { url: e.target.value } : { response: e.target.value })}
                          placeholder={button.style === 'link' ? 'https://...' : 'Svar når der klikkes'}
                        />
                        <Button variant="ghost" size="icon" onClick={() => setButtons((current) => current.filter((_, i) => i !== index))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {!buttons.length && <p className="text-sm text-muted-foreground">Ingen buttons.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Select Menu</CardTitle>
                    <CardDescription>
                      Format pr. linje: <code>Label|value|response</code>. Op til 25 options.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input value={selectPlaceholder} onChange={(e) => setSelectPlaceholder(e.target.value)} placeholder="Placeholder" />
                    <Textarea
                      value={selectOptions}
                      onChange={(e) => setSelectOptions(e.target.value)}
                      placeholder={'Support|support|Du valgte support\nSalg|sales|Du valgte salg'}
                      rows={7}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Button
              onClick={handleCreate}
              disabled={!form.name || !form.trigger || createCommand.isPending}
              className="w-full"
            >
              {createCommand.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Opret command
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {commands.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Terminal className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">Ingen custom commands oprettet endnu</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {commands.map((cmd) => {
            const restrictionCount =
              (cmd.allowed_role_ids?.length ?? 0) +
              (cmd.blocked_role_ids?.length ?? 0) +
              (cmd.allowed_channels?.length ?? 0) +
              (cmd.blocked_channel_ids?.length ?? 0);

            return (
              <Card key={cmd.id} className="transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Hash className="h-4 w-4 text-primary" />
                        <CardTitle className="truncate text-base">{cmd.name}</CardTitle>
                        <Badge variant="outline" className="font-mono text-xs">{cmd.trigger}</Badge>
                      </div>
                      <CardDescription className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{triggerTypeLabels[cmd.trigger_type] ?? cmd.trigger_type}</Badge>
                        <Badge variant="secondary">{responseTypeLabels[cmd.response_type] ?? cmd.response_type}</Badge>
                        {restrictionCount > 0 && <Badge variant="outline"><LockKeyhole className="mr-1 h-3 w-3" />{restrictionCount} regler</Badge>}
                        {(cmd.response_buttons?.length ?? 0) > 0 && <Badge variant="outline">{cmd.response_buttons.length} buttons</Badge>}
                        {(cmd.response_selects?.length ?? 0) > 0 && <Badge variant="outline">Select</Badge>}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={cmd.enabled}
                        onCheckedChange={(enabled) => updateCommand.mutate({ id: cmd.id, enabled })}
                      />
                      <Button variant="ghost" size="icon" onClick={() => deleteCommand.mutate(cmd.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {cmd.description || cmd.response_content || 'Ingen beskrivelse'}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{cmd.usage_count} brug</span>
                    <span>{cmd.cooldown_seconds > 0 ? `${cmd.cooldown_seconds}s cooldown` : 'Ingen cooldown'}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccessList({
  title,
  description,
  items,
  values,
  onToggle,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; label: string }>;
  values: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-52 rounded-lg border">
          <div className="space-y-1 p-2">
            {items.map((item) => (
              <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/40">
                <Checkbox checked={values.includes(item.id)} onCheckedChange={() => onToggle(item.id)} />
                <span className="truncate text-sm">{item.label}</span>
              </label>
            ))}
            {!items.length && <p className="p-3 text-sm text-muted-foreground">Ingen items.</p>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
