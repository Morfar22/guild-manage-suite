import { useState, useEffect } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Save, Shield, MessageSquare, Hash, AlertTriangle } from 'lucide-react';

export default function Moderation() {
  const { selectedGuild, setSelectedGuild } = useGuild();
  const { language } = useLanguage();
  const en = language === 'en';
  const [saving, setSaving] = useState(false);
  const [prefix, setPrefix] = useState('!');
  const [logChannel, setLogChannel] = useState('');
  const [autoMod, setAutoMod] = useState(false);

  useEffect(() => {
    if (selectedGuild) { setPrefix(selectedGuild.command_prefix); setLogChannel(selectedGuild.log_channel_id || ''); setAutoMod(selectedGuild.auto_moderation_enabled); }
  }, [selectedGuild]);

  const handleSave = async () => {
    if (!selectedGuild) return;
    if (!prefix.trim()) { toast.error(en ? 'Prefix cannot be empty' : 'Prefix kan ikke være tom'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('guilds').update({ command_prefix: prefix.trim(), log_channel_id: logChannel.trim() || null, auto_moderation_enabled: autoMod }).eq('id', selectedGuild.id).select().single();
      if (error) throw error;
      setSelectedGuild(data);
      toast.success(en ? 'Settings saved' : 'Indstillinger gemt');
    } catch (err) { console.error('Error saving settings:', err); toast.error(en ? 'Could not save settings' : 'Kunne ikke gemme indstillinger'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{en ? 'Moderation Settings' : 'Moderationsindstillinger'}</h1>
        <p className="mt-1 text-muted-foreground">{en ? 'Configure moderation features for your server' : 'Konfigurer moderationsfunktioner for din server'}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><MessageSquare className="h-5 w-5" /></div>
            <div><h2 className="font-semibold text-foreground">{en ? 'General Settings' : 'Generelle Indstillinger'}</h2><p className="text-sm text-muted-foreground">{en ? 'Basic bot configuration' : 'Grundlæggende bot-konfiguration'}</p></div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prefix" className="text-foreground">{en ? 'Command Prefix' : 'Kommando Prefix'}</Label>
              <Input id="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="!" maxLength={5} className="bg-input border-border text-foreground placeholder:text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{en ? 'Character(s) that trigger bot commands (e.g. !, ?, $)' : 'Tegnet/tegnene der udløser bot-kommandoer (f.eks. !, ?, $)'}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logChannel" className="text-foreground">{en ? 'Log Channel ID' : 'Log Kanal ID'}</Label>
              <div className="relative"><Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="logChannel" value={logChannel} onChange={(e) => setLogChannel(e.target.value)} placeholder="123456789012345678" className="bg-input border-border text-foreground placeholder:text-muted-foreground pl-9" /></div>
              <p className="text-xs text-muted-foreground">{en ? 'Channel ID where moderation logs are sent' : 'Kanal-ID hvor moderations-logs sendes til'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning"><Shield className="h-5 w-5" /></div>
            <div><h2 className="font-semibold text-foreground">Auto-Moderation</h2><p className="text-sm text-muted-foreground">{en ? 'Automatic content filtering' : 'Automatisk indholdsfiltrering'}</p></div>
          </div>
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-lg bg-muted/30 p-4">
              <div className="space-y-0.5">
                <Label className="text-foreground font-medium">{en ? 'Enable Auto-Moderation' : 'Aktiver Auto-Moderation'}</Label>
                <p className="text-sm text-muted-foreground">{en ? 'Automatically filter spam, links and inappropriate content' : 'Filtrer automatisk spam, links og upassende indhold'}</p>
              </div>
              <Switch checked={autoMod} onCheckedChange={setAutoMod} className="data-[state=checked]:bg-primary" />
            </div>
            {autoMod && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" /><span>{en ? 'Auto-mod filters:' : 'Auto-mod filtrerer:'}</span></div>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground pl-6">
                  <li>{en ? 'Spam and repeated messages' : 'Spam og gentagne beskeder'}</li>
                  <li>{en ? 'Suspicious links and invitations' : 'Mistænkelige links og invitationer'}</li>
                  <li>{en ? 'Mass mentions' : 'Masse-mentions'}</li>
                  <li>{en ? 'Excessive caps and emojis' : 'Overdrevne caps og emojis'}</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gradient-blurple text-primary-foreground hover:opacity-90">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{en ? 'Save Changes' : 'Gem Ændringer'}
        </Button>
      </div>
    </div>
  );
}
