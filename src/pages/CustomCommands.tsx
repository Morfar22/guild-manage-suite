import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2, Terminal, Zap, Hash, BarChart3 } from 'lucide-react';
import { useCustomCommands, CreateCustomCommand } from '@/hooks/useCustomCommands';

export default function CustomCommands() {
  const { commands, isLoading, createCommand, updateCommand, deleteCommand } = useCustomCommands();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateCustomCommand>({
    name: '',
    trigger: '',
    trigger_type: 'command',
    response_type: 'text',
    response_content: '',
    cooldown_seconds: 0,
    description: '',
  });

  const handleCreate = () => {
    if (!form.name || !form.trigger || !form.response_content) return;
    createCommand.mutate(form, {
      onSuccess: () => {
        setOpen(false);
        setForm({ name: '', trigger: '', trigger_type: 'command', response_type: 'text', response_content: '', cooldown_seconds: 0, description: '' });
      },
    });
  };

  const triggerTypeLabels: Record<string, string> = {
    command: 'Kommando (!trigger)',
    keyword: 'Nøgleord (indeholder)',
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Custom Commands</h1>
          <p className="text-muted-foreground">
            Opret egne bot-kommandoer med tilpassede svar, embeds og rolle-tildeling
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Ny Kommando</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Opret Custom Kommando</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Navn</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="F.eks. regler" />
                </div>
                <div className="space-y-2">
                  <Label>Trigger</Label>
                  <Input value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} placeholder="F.eks. !regler" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Beskrivelse (valgfri)</Label>
                <Input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Kort beskrivelse af kommandoen" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trigger Type</Label>
                  <Select value={form.trigger_type} onValueChange={(v) => setForm({ ...form, trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="command">Kommando (!trigger)</SelectItem>
                      <SelectItem value="keyword">Nøgleord (indeholder)</SelectItem>
                      <SelectItem value="startswith">Starter med</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Svar Type</Label>
                  <Select value={form.response_type} onValueChange={(v) => setForm({ ...form, response_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Tekst</SelectItem>
                      <SelectItem value="embed">Embed</SelectItem>
                      <SelectItem value="role_toggle">Rolle toggle</SelectItem>
                      <SelectItem value="random">Tilfældig</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Svar Indhold</Label>
                <Textarea
                  value={form.response_content ?? ''}
                  onChange={(e) => setForm({ ...form, response_content: e.target.value })}
                  placeholder="Skriv kommandoens svar... (brug {user} for brugerens mention, {server} for servernavn)"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Cooldown (sekunder)</Label>
                <Input type="number" min={0} value={form.cooldown_seconds ?? 0} onChange={(e) => setForm({ ...form, cooldown_seconds: parseInt(e.target.value) || 0 })} />
              </div>

              <Button onClick={handleCreate} disabled={!form.name || !form.trigger || !form.response_content || createCommand.isPending} className="w-full">
                {createCommand.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                Opret Kommando
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {commands.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Terminal className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">Ingen custom commands oprettet endnu</p>
            <p className="text-sm text-muted-foreground">Klik "Ny Kommando" for at komme i gang</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {commands.map((cmd) => (
            <Card key={cmd.id} className="transition-all hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">{cmd.name}</CardTitle>
                    <Badge variant="outline" className="font-mono text-xs">{cmd.trigger}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={cmd.enabled}
                      onCheckedChange={(enabled) => updateCommand.mutate({ id: cmd.id, enabled })}
                    />
                    <Button variant="ghost" size="icon" onClick={() => deleteCommand.mutate(cmd.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{triggerTypeLabels[cmd.trigger_type] ?? cmd.trigger_type}</Badge>
                  <Badge variant="secondary" className="text-xs">{responseTypeLabels[cmd.response_type] ?? cmd.response_type}</Badge>
                  {cmd.cooldown_seconds > 0 && <span className="text-xs">{cmd.cooldown_seconds}s cooldown</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm line-clamp-3 text-muted-foreground">{cmd.response_content || cmd.description || 'Ingen beskrivelse'}</p>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <BarChart3 className="h-3 w-3" />
                  <span>{cmd.usage_count} gange brugt</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
