import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ChannelSelect } from '@/components/ui/channel-select';
import { useWelcomeSettings, useUpdateWelcomeSettings } from '@/hooks/useWelcomeSettings';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { useToast } from '@/hooks/use-toast';
import { Save, UserPlus, DoorOpen, Shield, Loader2, Send, Eye, MessageSquare, Palette, ImageIcon, Type } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useGuild } from '@/contexts/GuildContext';
import { DiscordEmbedPreview, DiscordMessagePreview } from '@/components/discord/DiscordEmbedPreview';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { invokeFunction } from '@/lib/functions-client';

export default function WelcomeSettings() {
  const { data: settings, isLoading } = useWelcomeSettings();
  const { data: roles, isLoading: rolesLoading } = useDiscordRoles();
  const updateSettings = useUpdateWelcomeSettings();
  const { toast } = useToast();
  const { selectedGuild } = useGuild();
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingLeave, setIsTestingLeave] = useState(false);
  const [showWelcomePreview, setShowWelcomePreview] = useState(false);
  const [showLeavePreview, setShowLeavePreview] = useState(false);

  const [formData, setFormData] = useState({
    enabled: false,
    welcome_channel_id: '',
    welcome_message: 'Velkommen til serveren, {user}! 🎉',
    leave_enabled: false,
    leave_channel_id: '',
    leave_message: '{user} har forladt serveren.',
    dm_enabled: false,
    dm_message: 'Velkommen til {server}! Læs venligst reglerne.',
    auto_role_enabled: false,
    auto_role_id: '',
    auto_role_ids: [] as string[],
    embed_enabled: true,
    embed_color: '#5865F2',
    embed_title: '🎉 Et nyt medlem er ankommet!',
    embed_footer: '',
    embed_image_url: '',
    leave_embed_enabled: false,
    thumbnail_type: 'user_avatar' as 'user_avatar' | 'server_icon',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        enabled: settings.enabled,
        welcome_channel_id: settings.welcome_channel_id || '',
        welcome_message: settings.welcome_message || 'Velkommen til serveren, {user}! 🎉',
        leave_enabled: settings.leave_enabled,
        leave_channel_id: settings.leave_channel_id || '',
        leave_message: settings.leave_message || '{user} har forladt serveren.',
        dm_enabled: settings.dm_enabled,
        dm_message: settings.dm_message || 'Velkommen til {server}! Læs venligst reglerne.',
        auto_role_enabled: settings.auto_role_enabled,
        auto_role_id: settings.auto_role_id || '',
        auto_role_ids: (settings as any).auto_role_ids || [],
        embed_enabled: settings.embed_enabled,
        embed_color: settings.embed_color || '#5865F2',
        embed_title: settings.embed_title || '🎉 Et nyt medlem er ankommet!',
        embed_footer: settings.embed_footer || '',
        embed_image_url: settings.embed_image_url || '',
        leave_embed_enabled: settings.leave_embed_enabled || false,
        thumbnail_type: settings.thumbnail_type || 'user_avatar',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(formData);
      toast({ title: 'Gemt!', description: 'Velkomstindstillinger er opdateret.' });
    } catch (error) {
      toast({ title: 'Fejl', description: 'Kunne ikke gemme indstillinger.', variant: 'destructive' });
    }
  };

  const handleTestWelcome = async () => {
    if (!selectedGuild?.id) {
      toast({ title: 'Fejl', description: 'Ingen server valgt.', variant: 'destructive' });
      return;
    }
    if (!formData.welcome_channel_id) {
      toast({ title: 'Manglende kanal', description: 'Vælg en velkomstkanal først.', variant: 'destructive' });
      return;
    }
    setIsTesting(true);
    try {
      const { data, error } = await invokeFunction('bot-welcome', {
        body: { action: 'testWelcome', data: { guildId: selectedGuild.id, username: 'TestUser' } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: '✅ Test sendt!', description: 'Tjek velkomstkanalen på Discord.' });
    } catch (error: any) {
      toast({ title: 'Fejl', description: error.message || 'Kunne ikke sende testbesked.', variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestLeave = async () => {
    if (!selectedGuild?.id) {
      toast({ title: 'Fejl', description: 'Ingen server valgt.', variant: 'destructive' });
      return;
    }
    const channelId = formData.leave_channel_id || formData.welcome_channel_id;
    if (!channelId) {
      toast({ title: 'Manglende kanal', description: 'Vælg en kanal først.', variant: 'destructive' });
      return;
    }
    setIsTestingLeave(true);
    try {
      const { data, error } = await invokeFunction('bot-welcome', {
        body: { action: 'testLeave', data: { guildId: selectedGuild.id, username: 'TestUser' } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: '✅ Test sendt!', description: 'Tjek farvelkanalen på Discord.' });
    } catch (error: any) {
      toast({ title: 'Fejl', description: error.message || 'Kunne ikke sende testbesked.', variant: 'destructive' });
    } finally {
      setIsTestingLeave(false);
    }
  };

  const getColorHex = (color: number) => {
    if (color === 0) return '#99AAB5';
    return '#' + color.toString(16).padStart(6, '0');
  };

  const formatPreviewMessage = (msg: string) => msg
    .replace(/{user}/g, '@TestUser')
    .replace(/{username}/g, 'TestUser')
    .replace(/{server}/g, selectedGuild?.guild_name || 'Test Server')
    .replace(/{membercount}/g, '42');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Velkomstsystem</h1>
          <p className="text-muted-foreground">Konfigurer velkomst- og farvelbeskeder</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleTestWelcome} disabled={isTesting || !formData.enabled}>
            {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Test Velkomst
          </Button>
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Gem Ændringer
          </Button>
        </div>
      </div>

      {/* Welcome Message */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              <CardTitle>Velkomstbesked</CardTitle>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>
          <CardDescription>Send en besked når nye medlemmer joiner</CardDescription>
        </CardHeader>
        {formData.enabled && (
          <CardContent className="space-y-4">
            <div>
              <Label>Velkomstkanal</Label>
              <ChannelSelect
                value={formData.welcome_channel_id}
                onValueChange={(value) => setFormData({ ...formData, welcome_channel_id: value })}
                placeholder="Vælg velkomstkanal"
              />
            </div>
            <div>
              <Label>Besked</Label>
              <Textarea
                placeholder="Velkomstbesked..."
                value={formData.welcome_message}
                onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variabler: {'{user}'} mention, {'{username}'} navn, {'{server}'} servernavn, {'{membercount}'} antal medlemmer
              </p>
            </div>

            {/* Embed Settings */}
            <Separator />
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">Embed-indstillinger</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.embed_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, embed_enabled: checked })}
              />
              <Label>Brug Embed</Label>
            </div>
            {formData.embed_enabled && (
              <div className="space-y-4 pl-2 border-l-2 border-primary/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-1"><Type className="h-3 w-3" /> Embed-titel</Label>
                    <Input
                      placeholder="🎉 Et nyt medlem er ankommet!"
                      value={formData.embed_title}
                      onChange={(e) => setFormData({ ...formData, embed_title: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Variabler virker også her</p>
                  </div>
                  <div>
                    <Label>Embed-farve</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={formData.embed_color}
                        onChange={(e) => setFormData({ ...formData, embed_color: e.target.value })}
                        className="w-12 h-8 p-1"
                      />
                      <Input
                        value={formData.embed_color}
                        onChange={(e) => setFormData({ ...formData, embed_color: e.target.value })}
                        placeholder="#5865F2"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Footer-tekst</Label>
                  <Input
                    placeholder={`${selectedGuild?.guild_name || 'Server'} • Vi er glade for at have dig her!`}
                    value={formData.embed_footer}
                    onChange={(e) => setFormData({ ...formData, embed_footer: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Lad tom for standard-footer</p>
                </div>
                <div>
                  <Label className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Banner-billede URL</Label>
                  <Input
                    placeholder="https://example.com/welcome-banner.png"
                    value={formData.embed_image_url}
                    onChange={(e) => setFormData({ ...formData, embed_image_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Valgfrit stort billede i bunden af embed</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Thumbnail</Label>
                  <Select
                    value={formData.thumbnail_type}
                    onValueChange={(v) => setFormData({ ...formData, thumbnail_type: v as 'user_avatar' | 'server_icon' })}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="user_avatar">👤 Brugerens avatar</SelectItem>
                      <SelectItem value="server_icon">🖼️ Server ikon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Collapsible open={showWelcomePreview} onOpenChange={setShowWelcomePreview}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Eye className="h-4 w-4" />
                  {showWelcomePreview ? 'Skjul forhåndsvisning' : 'Vis forhåndsvisning'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="rounded-lg border border-border bg-background/50 p-4">
                  <p className="text-xs text-muted-foreground mb-3">Sådan vil beskeden se ud i Discord:</p>
                  {formData.embed_enabled ? (
                    <DiscordEmbedPreview
                      author={{ name: 'Velkommen, TestUser!', icon_url: 'https://cdn.discordapp.com/embed/avatars/0.png' }}
                      title={formatPreviewMessage(formData.embed_title || '🎉 Et nyt medlem er ankommet!')}
                      description={formatPreviewMessage(formData.welcome_message)}
                      color={formData.embed_color}
                      fields={[
                        { name: '👤 Bruger', value: '@TestUser', inline: true },
                        { name: '📊 Medlem #', value: '42', inline: true },
                        { name: '📅 Joined', value: 'lige nu', inline: true },
                      ]}
                      footer={formData.embed_footer 
                        ? formatPreviewMessage(formData.embed_footer) 
                        : `${selectedGuild?.guild_name || 'Server'} • Vi er glade for at have dig her!`}
                    />
                  ) : (
                    <DiscordMessagePreview content={formatPreviewMessage(formData.welcome_message)} />
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        )}
      </Card>

      {/* Leave Message */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5" />
              <CardTitle>Farvelbesked</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {formData.leave_enabled && (
                <Button variant="outline" size="sm" onClick={handleTestLeave} disabled={isTestingLeave}>
                  {isTestingLeave ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                  Test
                </Button>
              )}
              <Switch
                checked={formData.leave_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, leave_enabled: checked })}
              />
            </div>
          </div>
          <CardDescription>Send en besked når medlemmer forlader serveren</CardDescription>
        </CardHeader>
        {formData.leave_enabled && (
          <CardContent className="space-y-4">
            <div>
              <Label>Farvelkanal</Label>
              <ChannelSelect
                value={formData.leave_channel_id}
                onValueChange={(value) => setFormData({ ...formData, leave_channel_id: value })}
                placeholder="Vælg farvelkanal (eller brug samme som velkomst)"
              />
            </div>
            <div>
              <Label>Besked</Label>
              <Textarea
                placeholder="Farvelbesked..."
                value={formData.leave_message}
                onChange={(e) => setFormData({ ...formData, leave_message: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.leave_embed_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, leave_embed_enabled: checked })}
              />
              <Label>Brug embed til farvelbesked</Label>
            </div>

            <Collapsible open={showLeavePreview} onOpenChange={setShowLeavePreview}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Eye className="h-4 w-4" />
                  {showLeavePreview ? 'Skjul forhåndsvisning' : 'Vis forhåndsvisning'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="rounded-lg border border-border bg-background/50 p-4">
                  <p className="text-xs text-muted-foreground mb-3">Sådan vil beskeden se ud i Discord:</p>
                  {formData.leave_embed_enabled ? (
                    <DiscordEmbedPreview
                      title="👋 Et medlem har forladt os"
                      description={formatPreviewMessage(formData.leave_message)}
                      color="#ED4245"
                      footer={selectedGuild?.guild_name || 'Server'}
                    />
                  ) : (
                    <DiscordMessagePreview content={formatPreviewMessage(formData.leave_message)} />
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        )}
      </Card>

      {/* DM Message */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <CardTitle>Velkomst-DM</CardTitle>
            </div>
            <Switch
              checked={formData.dm_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, dm_enabled: checked })}
            />
          </div>
          <CardDescription>Send en privat besked til nye medlemmer</CardDescription>
        </CardHeader>
        {formData.dm_enabled && (
          <CardContent>
            <div>
              <Label>DM-besked</Label>
              <Textarea
                placeholder="Privat velkomstbesked..."
                value={formData.dm_message}
                onChange={(e) => setFormData({ ...formData, dm_message: e.target.value })}
                rows={4}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Auto Role */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Auto-rolle</CardTitle>
            </div>
            <Switch
              checked={formData.auto_role_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_role_enabled: checked })}
            />
          </div>
          <CardDescription>Tildel automatisk roller til nye medlemmer</CardDescription>
        </CardHeader>
        {formData.auto_role_enabled && (
          <CardContent>
            <div>
              <Label>Vælg Roller</Label>
              {rolesLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Henter roller fra Discord...</span>
                </div>
              ) : roles && roles.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
                  {roles.map((role) => {
                    const isChecked = formData.auto_role_ids.includes(role.id);
                    return (
                      <div key={role.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`role-${role.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const newIds = checked
                              ? [...formData.auto_role_ids, role.id]
                              : formData.auto_role_ids.filter(id => id !== role.id);
                            setFormData({ ...formData, auto_role_ids: newIds, auto_role_id: newIds[0] || '' });
                          }}
                        />
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getColorHex(role.color) }}
                        />
                        <label htmlFor={`role-${role.id}`} className="text-sm cursor-pointer">{role.name}</label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Kunne ikke hente roller. Indtast rolle-ID manuelt:
                  </p>
                  <Input
                    placeholder="Indtast rolle-ID"
                    value={formData.auto_role_id}
                    onChange={(e) => setFormData({ ...formData, auto_role_id: e.target.value })}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Botten skal have en rolle højere end den valgte rolle for at tildele den
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
