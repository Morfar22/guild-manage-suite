import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, CheckCircle, XCircle, Send } from 'lucide-react';
import { useVerificationSettings } from '@/hooks/useVerificationSettings';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { useGuild } from '@/contexts/GuildContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function VerificationSettings() {
  const { settings, isLoading, logs, updateSettings } = useVerificationSettings();
  const { data: channelsData } = useDiscordChannels();
  const { data: roles } = useDiscordRoles();
  const { selectedGuild } = useGuild();
  const { t } = useLanguage();
  const [sendingPanel, setSendingPanel] = useState(false);

  const textChannels = channelsData?.channels?.filter(c => c.type === 0) || [];

  const handleSendPanel = async () => {
    if (!selectedGuild?.id) return;
    setSendingPanel(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-panel', {
        body: { guildId: selectedGuild.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Verifikationspanel sendt til kanalen!');
    } catch (err: any) {
      toast.error(err.message || 'Kunne ikke sende panel');
    } finally {
      setSendingPanel(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><ShieldCheck className="h-8 w-8" /> {t('verification.title')}</h1>
        <p className="text-muted-foreground">{t('verification.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('common.settings')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t('verification.enable')}</Label>
            <Switch
              checked={settings?.enabled ?? false}
              onCheckedChange={v => updateSettings.mutate({ enabled: v })}
            />
          </div>
          <div>
            <Label>{t('verification.channel')}</Label>
            <Select value={settings?.channel_id || ''} onValueChange={v => updateSettings.mutate({ channel_id: v })}>
              <SelectTrigger><SelectValue placeholder={t('common.selectChannel')} /></SelectTrigger>
              <SelectContent>
                {textChannels.map(ch => (
                  <SelectItem key={ch.id} value={ch.id}>#{ch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('verification.role')}</Label>
            <Select value={settings?.role_id || ''} onValueChange={v => updateSettings.mutate({ role_id: v })}>
              <SelectTrigger><SelectValue placeholder={t('common.selectRole')} /></SelectTrigger>
              <SelectContent>
                {(roles || []).map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>@{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('verification.method')}</Label>
            <Select value={settings?.method || 'button'} onValueChange={v => updateSettings.mutate({ method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="button">{t('verification.button')}</SelectItem>
                <SelectItem value="captcha">{t('verification.captcha')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('verification.welcomeMessage')}</Label>
            <Textarea
              value={settings?.welcome_message || ''}
              onChange={e => updateSettings.mutate({ welcome_message: e.target.value })}
              placeholder={t('verification.welcomePlaceholder')}
              rows={3}
            />
          </div>
          <div>
            <Label>{t('verification.rateLimit')}</Label>
            <Input
              type="number"
              value={settings?.rate_limit_per_minute ?? 5}
              onChange={e => updateSettings.mutate({ rate_limit_per_minute: parseInt(e.target.value) || 5 })}
              min={1}
              max={60}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5" /> Send Verifikationspanel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Send et permanent verifikationspanel til den valgte kanal. Alle nye medlemmer kan klikke på knappen for at verificere sig.
          </p>
          <Button onClick={handleSendPanel} disabled={sendingPanel || !settings?.enabled || !settings?.channel_id}>
            <Send className="h-4 w-4 mr-2" />
            {sendingPanel ? 'Sender...' : 'Send Panel'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('verification.recentLogs')}</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('verification.noLogs')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.user')}</TableHead>
                  <TableHead>{t('verification.method')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('automod.time')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>{log.user_name || log.user_id}</TableCell>
                    <TableCell><Badge variant="outline">{log.method || 'button'}</Badge></TableCell>
                    <TableCell>
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
