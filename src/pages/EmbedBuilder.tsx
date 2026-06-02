import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Send, Save, Loader2, Link, Pencil, X } from 'lucide-react';
import { DiscordEmbedPreview } from '@/components/discord/DiscordEmbedPreview';
import { DonationGoalDialog } from '@/components/embeds/DonationGoalDialog';
import { useSavedEmbeds, type EmbedData } from '@/hooks/useSavedEmbeds';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { useGuild } from '@/contexts/GuildContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const defaultEmbed: EmbedData = {
  title: '',
  description: '',
  color: '#5865F2',
  fields: [],
  footer: '',
  thumbnail: '',
  image: '',
  timestamp: true,
  buttons: [],
};

export default function EmbedBuilder() {
  const { selectedGuild } = useGuild();
  const { data: savedEmbeds, saveEmbed, updateEmbed, deleteEmbed } = useSavedEmbeds();
  const { data: channelsData } = useDiscordChannels();
  const [embed, setEmbed] = useState<EmbedData>({ ...defaultEmbed });
  const [templateName, setTemplateName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [sending, setSending] = useState(false);

  const textChannels = channelsData?.channels?.filter(c => c.type === 0) || [];

  const updateField = (key: keyof EmbedData, value: any) => {
    setEmbed(prev => ({ ...prev, [key]: value }));
  };

  const addField = () => {
    setEmbed(prev => ({
      ...prev,
      fields: [...(prev.fields || []), { name: 'Felt', value: 'Værdi', inline: false }],
    }));
  };

  const updateEmbedField = (index: number, key: string, value: any) => {
    setEmbed(prev => ({
      ...prev,
      fields: prev.fields?.map((f, i) => (i === index ? { ...f, [key]: value } : f)),
    }));
  };

  const removeField = (index: number) => {
    setEmbed(prev => ({
      ...prev,
      fields: prev.fields?.filter((_, i) => i !== index),
    }));
  };

  const addButton = () => {
    setEmbed(prev => ({
      ...prev,
      buttons: [...(prev.buttons || []), { label: 'Klik her', url: 'https://', emoji: '' }],
    }));
  };

  const updateButton = (index: number, key: string, value: string) => {
    setEmbed(prev => ({
      ...prev,
      buttons: prev.buttons?.map((b, i) => (i === index ? { ...b, [key]: value } : b)),
    }));
  };

  const removeButton = (index: number) => {
    setEmbed(prev => ({
      ...prev,
      buttons: prev.buttons?.filter((_, i) => i !== index),
    }));
  };

  const loadTemplate = (saved: any) => {
    setEmbed(saved.embed_data);
    setTemplateName(saved.name);
    setEditingId(saved.id);
  };

  const clearEditor = () => {
    setEmbed({ ...defaultEmbed });
    setTemplateName('');
    setEditingId(null);
  };

  const handleSave = () => {
    if (!templateName.trim()) {
      toast.error('Angiv et navn til din template');
      return;
    }
    if (editingId) {
      updateEmbed.mutate({ id: editingId, name: templateName, embed_data: embed });
    } else {
      saveEmbed.mutate({ name: templateName, embed_data: embed });
    }
  };

  const handleSend = async () => {
    if (!selectedChannel) {
      toast.error('Vælg en kanal');
      return;
    }
    if (!embed.title && !embed.description) {
      toast.error('Embed skal have en titel eller beskrivelse');
      return;
    }
    setSending(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-embed`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            guildId: selectedGuild?.id,
            channelId: selectedChannel,
            embed,
            buttons: embed.buttons?.filter(b => b.url && b.label),
          }),
        }
      );
      if (!response.ok) throw new Error('Kunne ikke sende embed');
      toast.success('Embed sendt!');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Embed Builder</h1>
          <p className="text-muted-foreground">Byg og send custom embeds til dine kanaler</p>
        </div>
        <DonationGoalDialog onGenerate={(e) => { setEmbed(e); setEditingId(null); setTemplateName('Donation Goal'); }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Embed Indhold</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Titel</Label>
                <Input value={embed.title || ''} onChange={e => updateField('title', e.target.value)} placeholder="Embed titel" />
              </div>
              <div>
                <Label>Beskrivelse</Label>
                <Textarea value={embed.description || ''} onChange={e => updateField('description', e.target.value)} placeholder="Embed beskrivelse..." rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Farve</Label>
                  <div className="flex gap-2">
                    <input type="color" value={embed.color || '#5865F2'} onChange={e => updateField('color', e.target.value)} className="h-10 w-12 rounded border border-input cursor-pointer" />
                    <Input value={embed.color || '#5865F2'} onChange={e => updateField('color', e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div>
                  <Label>Footer</Label>
                  <Input value={embed.footer || ''} onChange={e => updateField('footer', e.target.value)} placeholder="Footer tekst" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Thumbnail URL</Label>
                  <Input value={embed.thumbnail || ''} onChange={e => updateField('thumbnail', e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <Label>Image URL</Label>
                  <Input value={embed.image || ''} onChange={e => updateField('image', e.target.value)} placeholder="https://..." />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={embed.timestamp ?? true} onCheckedChange={v => updateField('timestamp', v)} />
                <Label>Vis timestamp</Label>
              </div>
            </CardContent>
          </Card>

          {/* Fields */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Felter</CardTitle>
              <Button size="sm" variant="outline" onClick={addField}>
                <Plus className="h-4 w-4 mr-1" /> Tilføj felt
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(embed.fields || []).map((field, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <Input value={field.name} onChange={e => updateEmbedField(i, 'name', e.target.value)} placeholder="Felt navn" />
                    <Input value={field.value} onChange={e => updateEmbedField(i, 'value', e.target.value)} placeholder="Felt værdi" />
                    <div className="flex items-center gap-2">
                      <Switch checked={field.inline ?? false} onCheckedChange={v => updateEmbedField(i, 'inline', v)} />
                      <Label className="text-xs">Inline</Label>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeField(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {(!embed.fields || embed.fields.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-2">Ingen felter endnu</p>
              )}
            </CardContent>
          </Card>

          {/* Buttons / Links */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Knapper (Links)</CardTitle>
              <Button size="sm" variant="outline" onClick={addButton} disabled={(embed.buttons?.length || 0) >= 5}>
                <Link className="h-4 w-4 mr-1" /> Tilføj knap
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(embed.buttons || []).map((btn, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={btn.label} onChange={e => updateButton(i, 'label', e.target.value)} placeholder="Knap tekst" />
                      <Input value={btn.emoji || ''} onChange={e => updateButton(i, 'emoji', e.target.value)} placeholder="Emoji (valgfrit)" />
                    </div>
                    <Input value={btn.url} onChange={e => updateButton(i, 'url', e.target.value)} placeholder="https://..." />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeButton(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {(!embed.buttons || embed.buttons.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-2">Ingen knapper endnu</p>
              )}
            </CardContent>
          </Card>


          <Card>
            <CardContent className="pt-6 space-y-4">
              {editingId && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-accent/50 rounded-md px-3 py-2">
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Redigerer: <strong>{templateName}</strong></span>
                  <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" onClick={clearEditor}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template navn..." className="flex-1" />
                <Button onClick={handleSave} disabled={saveEmbed.isPending || updateEmbed.isPending}>
                  <Save className="h-4 w-4 mr-1" /> {editingId ? 'Opdater' : 'Gem'}
                </Button>
              </div>
              <div className="flex gap-2">
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Vælg kanal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {textChannels.map(ch => (
                      <SelectItem key={ch.id} value={ch.id}>#{ch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleSend} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview & Templates */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Live Preview</CardTitle>
            </CardHeader>
            <CardContent className="bg-[#313338] rounded-lg p-4">
              <DiscordEmbedPreview
                title={embed.title}
                description={embed.description || 'Din embed preview vises her...'}
                color={embed.color}
                fields={embed.fields}
                footer={embed.footer}
                thumbnail={embed.thumbnail}
                timestamp={embed.timestamp}
                buttons={embed.buttons}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gemte Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(savedEmbeds || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Ingen gemte templates</p>
              ) : (
                (savedEmbeds || []).map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                    <button className="text-sm font-medium text-left flex-1" onClick={() => loadTemplate(t)}>
                      {t.name}
                    </button>
                    <Button size="icon" variant="ghost" onClick={() => loadTemplate(t)} title="Rediger">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteEmbed.mutate(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
