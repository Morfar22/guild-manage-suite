import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Lightbulb, ThumbsUp, ThumbsDown, CheckCircle, XCircle } from 'lucide-react';
import { useSuggestionSettings } from '@/hooks/useSuggestionSettings';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SuggestionSettings() {
  const { settings, settingsLoading, suggestions, updateSettings, updateSuggestionStatus } = useSuggestionSettings();
  const { data: channelsData } = useDiscordChannels();
  const { t } = useLanguage();
  const [response, setResponse] = useState('');

  const textChannels = channelsData?.channels?.filter(c => c.type === 0) || [];

  if (settingsLoading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-500/20 text-green-400">{t('suggestions.approved')}</Badge>;
      case 'denied': return <Badge className="bg-red-500/20 text-red-400">{t('suggestions.denied')}</Badge>;
      default: return <Badge className="bg-yellow-500/20 text-yellow-400">{t('common.pending')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Lightbulb className="h-8 w-8" /> {t('suggestions.title')}</h1>
        <p className="text-muted-foreground">{t('suggestions.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('common.settings')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t('suggestions.enable')}</Label>
            <Switch
              checked={settings?.enabled ?? false}
              onCheckedChange={v => updateSettings.mutate({ enabled: v })}
            />
          </div>
          <div>
            <Label>{t('suggestions.channel')}</Label>
            <Select value={settings?.channel_id || ''} onValueChange={v => updateSettings.mutate({ channel_id: v })}>
              <SelectTrigger><SelectValue placeholder={t('common.selectChannel')} /></SelectTrigger>
              <SelectContent>
                {textChannels.map(ch => (
                  <SelectItem key={ch.id} value={ch.id}>#{ch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('suggestions.embedColor')}</Label>
              <div className="flex gap-2">
                <input type="color" value={settings?.color || '#5865F2'} onChange={e => updateSettings.mutate({ color: e.target.value })} className="h-10 w-12 rounded border border-input cursor-pointer" />
                <Input value={settings?.color || '#5865F2'} onChange={e => updateSettings.mutate({ color: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={settings?.anonymous_mode ?? false}
                onCheckedChange={v => updateSettings.mutate({ anonymous_mode: v })}
              />
              <Label>{t('suggestions.anonymousMode')}</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('suggestions.count', { count: suggestions.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('suggestions.noSuggestions')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('suggestions.author')}</TableHead>
                  <TableHead>{t('suggestions.suggestion')}</TableHead>
                  <TableHead>{t('suggestions.votes')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.author_name || s.author_id}</TableCell>
                    <TableCell className="max-w-xs truncate">{s.content}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-green-400"><ThumbsUp className="h-3 w-3" />{s.upvotes}</span>
                        <span className="flex items-center gap-1 text-red-400"><ThumbsDown className="h-3 w-3" />{s.downvotes}</span>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell>
                      {s.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => updateSuggestionStatus.mutate({ id: s.id, status: 'approved' })}>
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => updateSuggestionStatus.mutate({ id: s.id, status: 'denied' })}>
                            <XCircle className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      )}
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
