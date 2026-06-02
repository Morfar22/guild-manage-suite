import { useState } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useLogSettings, LOG_CATEGORIES, LogSettingKey } from '@/hooks/useLogSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChannelSelect } from '@/components/ui/channel-select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  Users, 
  MessageSquare, 
  Shield, 
  Hash, 
  Mic, 
  Settings,
  Save,
  Loader2,
  MessageCircle,
  Smile,
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  Users: <Users className="h-5 w-5" />,
  MessageSquare: <MessageSquare className="h-5 w-5" />,
  Shield: <Shield className="h-5 w-5" />,
  Hash: <Hash className="h-5 w-5" />,
  Mic: <Mic className="h-5 w-5" />,
  Settings: <Settings className="h-5 w-5" />,
  MessageCircle: <MessageCircle className="h-5 w-5" />,
  Smile: <Smile className="h-5 w-5" />,
};

export default function LogSettings() {
  const { selectedGuild } = useGuild();
  const { data: settings, isLoading, updateSettings } = useLogSettings();

  const [localSettings, setLocalSettings] = useState<Record<string, boolean | string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const getSettingValue = (key: string): boolean => {
    if (key in localSettings) {
      return localSettings[key] as boolean;
    }
    return (settings as any)?.[key] ?? false;
  };

  const getChannelValue = (): string => {
    if ('log_channel_id' in localSettings) {
      return localSettings.log_channel_id as string;
    }
    return settings?.log_channel_id ?? '';
  };

  const getBoostChannelValue = (): string => {
    if ('boost_channel_id' in localSettings) {
      return localSettings.boost_channel_id as string;
    }
    return settings?.boost_channel_id ?? '';
  };

  const handleToggle = (key: LogSettingKey, value: boolean) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleChannelChange = (value: string) => {
    setLocalSettings(prev => ({ ...prev, log_channel_id: value }));
    setHasChanges(true);
  };

  const handleBoostChannelChange = (value: string) => {
    setLocalSettings(prev => ({ ...prev, boost_channel_id: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettings.mutate(localSettings as any);
    setHasChanges(false);
    setLocalSettings({});
  };

  const enableAllInCategory = (categoryKey: string) => {
    const category = LOG_CATEGORIES[categoryKey as keyof typeof LOG_CATEGORIES];
    const newSettings: Record<string, boolean> = {};
    category.settings.forEach(s => {
      newSettings[s.key] = true;
    });
    setLocalSettings(prev => ({ ...prev, ...newSettings }));
    setHasChanges(true);
  };

  const disableAllInCategory = (categoryKey: string) => {
    const category = LOG_CATEGORIES[categoryKey as keyof typeof LOG_CATEGORIES];
    const newSettings: Record<string, boolean> = {};
    category.settings.forEach(s => {
      newSettings[s.key] = false;
    });
    setLocalSettings(prev => ({ ...prev, ...newSettings }));
    setHasChanges(true);
  };

  if (!selectedGuild) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Vælg en server først</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            Log Indstillinger
          </h1>
          <p className="text-muted-foreground">Konfigurer hvilke events der skal logges til din log-kanal</p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Gem ændringer
        </Button>
      </div>

      {/* Log Channel Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Log Kanal</CardTitle>
          <CardDescription>Vælg hvilken kanal logs skal sendes til</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full max-w-md" />
          ) : (
            <div className="max-w-md">
              <ChannelSelect
                value={getChannelValue()}
                onValueChange={handleChannelChange}
                placeholder="Vælg en log-kanal..."
              />
              <p className="text-xs text-muted-foreground mt-2">
                Alle aktiverede logs sendes til denne kanal (medmindre en specifik kanal er valgt)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Boost Channel Override */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🚀 Boost Log Kanal
          </CardTitle>
          <CardDescription>Vælg en separat kanal til server boost notifikationer (valgfrit)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full max-w-md" />
          ) : (
            <div className="max-w-md">
              <ChannelSelect
                value={getBoostChannelValue()}
                onValueChange={handleBoostChannelChange}
                placeholder="Samme som log-kanal..."
              />
              <p className="text-xs text-muted-foreground mt-2">
                Hvis tom, sendes boost-logs til den generelle log-kanal
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Categories */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {Object.entries(LOG_CATEGORIES).map(([categoryKey, category]) => (
            <Card key={categoryKey}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {iconMap[category.icon]}
                    {category.label}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => enableAllInCategory(categoryKey)}
                    >
                      Alle
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disableAllInCategory(categoryKey)}
                    >
                      Ingen
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.settings.map((setting) => (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <Label className="font-medium">{setting.label}</Label>
                      <p className="text-xs text-muted-foreground">{setting.description}</p>
                    </div>
                    <Switch
                      checked={getSettingValue(setting.key)}
                      onCheckedChange={(checked) => handleToggle(setting.key, checked)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
