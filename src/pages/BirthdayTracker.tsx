import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Cake, Trash2 } from 'lucide-react';
import { useBirthdays } from '@/hooks/useBirthdays';
import { ChannelSelect } from '@/components/ui/channel-select';

const BirthdayTracker = () => {
  const { settings, birthdays, isLoading, upsertSettings, deleteBirthday } = useBirthdays();
  const [channelId, setChannelId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (settings) {
      setChannelId(settings.channel_id || '');
      setRoleId(settings.role_id || '');
      setMessageTemplate(settings.message_template || '');
      setEnabled(settings.enabled || false);
    }
  }, [settings]);

  const handleSave = () => {
    upsertSettings.mutate({
      channel_id: channelId || null,
      role_id: roleId || null,
      message_template: messageTemplate || null,
      enabled,
    });
  };

  if (isLoading) return <div className="flex items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">🎂 Fødselsdage</h1>
        <p className="text-muted-foreground mt-1">Automatisk fødselsdagsannoncering og rolle-tildeling</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Cake className="h-5 w-5" /> Indstillinger</CardTitle>
          <CardDescription>Konfigurer fødselsdagssystemet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Aktiveret</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="space-y-2">
            <Label>Annonceringskanal</Label>
            <ChannelSelect value={channelId} onValueChange={setChannelId} />
          </div>
          <div className="space-y-2">
            <Label>Fødselsdagsrolle ID</Label>
            <Input value={roleId} onChange={(e) => setRoleId(e.target.value)} placeholder="Rolle ID (tildeles på fødselsdagen)" />
          </div>
          <div className="space-y-2">
            <Label>Beskedskabelon</Label>
            <Input value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} placeholder="🎂 Tillykke med fødselsdagen, {user}! 🎉" />
            <p className="text-xs text-muted-foreground">Brug {'{user}'} som placeholder for bruger-mention</p>
          </div>
          <Button onClick={handleSave} disabled={upsertSettings.isPending}>{upsertSettings.isPending ? 'Gemmer...' : 'Gem Indstillinger'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrerede fødselsdage ({birthdays.length})</CardTitle>
          <CardDescription>Brugere registrerer sig via /birthday kommandoen</CardDescription>
        </CardHeader>
        <CardContent>
          {birthdays.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Ingen fødselsdage registreret endnu</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bruger</TableHead>
                  <TableHead>Dato</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {birthdays.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.user_name || b.user_id}</TableCell>
                    <TableCell>{new Date(b.birthday_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteBirthday.mutate(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
};

export default BirthdayTracker;
