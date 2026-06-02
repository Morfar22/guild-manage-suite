import { useState, useEffect } from 'react';
import { PremiumGate } from '@/components/premium/PremiumGate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Star, Save, Hash } from 'lucide-react';
import { useStarboardSettings } from '@/hooks/useStarboardSettings';
import { ChannelSelect } from '@/components/ui/channel-select';
import { useLanguage } from '@/contexts/LanguageContext';

export default function StarboardSettings() {
  return (
    <PremiumGate feature="starboard">
      <StarboardSettingsContent />
    </PremiumGate>
  );
}

function StarboardSettingsContent() {
  const { settings, entries, isLoading, updateSettings } = useStarboardSettings();
  const { t } = useLanguage();

  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [channelId, setChannelId] = useState(settings?.channel_id ?? '');
  const [emoji, setEmoji] = useState(settings?.emoji ?? '⭐');
  const [threshold, setThreshold] = useState(settings?.threshold ?? 5);
  const [ignoreSelfStar, setIgnoreSelfStar] = useState(settings?.ignore_self_star ?? true);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setChannelId(settings.channel_id ?? '');
      setEmoji(settings.emoji);
      setThreshold(settings.threshold);
      setIgnoreSelfStar(settings.ignore_self_star);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      enabled,
      channel_id: channelId || null,
      emoji,
      threshold,
      ignore_self_star: ignoreSelfStar,
    });
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
      <div>
        <h1 className="text-3xl font-bold">{t('starboard.title')}</h1>
        <p className="text-muted-foreground">{t('starboard.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              {t('starboard.settings')}
            </CardTitle>
            <CardDescription>{t('starboard.settingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('starboard.enable')}</Label>
                <p className="text-sm text-muted-foreground">{t('starboard.enableDesc')}</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="space-y-2">
              <Label>{t('starboard.channel')}</Label>
              <ChannelSelect
                value={channelId}
                onValueChange={setChannelId}
                placeholder={t('common.selectChannel')}
              />
              <p className="text-sm text-muted-foreground">{t('starboard.channelDesc')}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('starboard.emoji')}</Label>
                <Input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  placeholder="⭐"
                  className="text-center text-2xl"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('starboard.minReactions')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value) || 5)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>{t('starboard.ignoreSelf')}</Label>
                <p className="text-sm text-muted-foreground">{t('starboard.ignoreSelfDesc')}</p>
              </div>
              <Switch checked={ignoreSelfStar} onCheckedChange={setIgnoreSelfStar} />
            </div>

            <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full">
              {updateSettings.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t('common.saveSettings')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('starboard.recentStars')}</CardTitle>
            <CardDescription>{t('starboard.recentStarsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Star className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-muted-foreground">{t('starboard.noStars')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {entries.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-1 text-yellow-500">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="font-bold">{entry.star_count}</span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-medium">{entry.author_name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {entry.content || t('starboard.imageEmbed')}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Hash className="h-3 w-3" />
                        {entry.channel_id}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
