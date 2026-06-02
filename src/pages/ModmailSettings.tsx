import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Mail, Save, MessageSquare, Users, Clock } from 'lucide-react';
import { useModmail } from '@/hooks/useModmail';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { ChannelSelect } from '@/components/ui/channel-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

export default function ModmailSettings() {
  const { settings, openThreads, closedThreads, stats, isLoading, updateSettings } = useModmail();
  const rolesQuery = useDiscordRoles();
  const roles = rolesQuery.data ?? [];

  const [enabled, setEnabled] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [staffRoleId, setStaffRoleId] = useState('');
  const [logChannelId, setLogChannelId] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [closeMessage, setCloseMessage] = useState('');

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setCategoryId(settings.category_id ?? '');
      setStaffRoleId(settings.staff_role_id ?? '');
      setLogChannelId(settings.log_channel_id ?? '');
      setWelcomeMessage(settings.welcome_message ?? '');
      setCloseMessage(settings.close_message ?? '');
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      enabled,
      category_id: categoryId || null,
      staff_role_id: staffRoleId || null,
      log_channel_id: logChannelId || null,
      welcome_message: welcomeMessage || null,
      close_message: closeMessage || null,
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
        <h1 className="text-3xl font-bold">Modmail</h1>
        <p className="text-muted-foreground">
          Lad brugere kontakte staff via private beskeder til botten
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-full bg-green-500/10 p-3">
              <MessageSquare className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.openThreads}</p>
              <p className="text-sm text-muted-foreground">Åbne samtaler</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-full bg-muted p-3">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalThreads}</p>
              <p className="text-sm text-muted-foreground">Total samtaler</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-full bg-blue-500/10 p-3">
              <Clock className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.closedThreads}</p>
              <p className="text-sm text-muted-foreground">Lukkede samtaler</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings">Indstillinger</TabsTrigger>
          <TabsTrigger value="open">Åbne ({openThreads.length})</TabsTrigger>
          <TabsTrigger value="closed">Lukkede ({closedThreads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Generelle Indstillinger
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Aktiver Modmail</Label>
                    <p className="text-sm text-muted-foreground">
                      Brugere kan sende DMs til botten
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>

                <div className="space-y-2">
                  <Label>Staff Rolle</Label>
                  <Select value={staffRoleId} onValueChange={setStaffRoleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg rolle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Rolle der kan se modmail kanaler
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Log Kanal</Label>
                  <ChannelSelect
                    value={logChannelId}
                    onValueChange={setLogChannelId}
                    placeholder="Vælg kanal..."
                  />
                </div>

                <Button onClick={handleSave} disabled={updateSettings.isPending} className="w-full">
                  {updateSettings.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Gem Indstillinger
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Beskeder</CardTitle>
                <CardDescription>
                  Tilpas automatiske beskeder til brugere
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Velkomstbesked</Label>
                  <Textarea
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder="Tak for din henvendelse..."
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground">
                    Sendes når en bruger åbner modmail
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Lukkebesked</Label>
                  <Textarea
                    value={closeMessage}
                    onChange={(e) => setCloseMessage(e.target.value)}
                    placeholder="Denne samtale er nu lukket..."
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground">
                    Sendes når samtalen lukkes
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="open">
          <Card>
            <CardContent className="pt-6">
              {openThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">Ingen åbne samtaler</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {openThreads.map((thread) => (
                    <div
                      key={thread.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={thread.user_avatar ?? undefined} />
                          <AvatarFallback>
                            {thread.user_name?.slice(0, 2).toUpperCase() ?? '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{thread.user_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Åbnet {formatDistanceToNow(new Date(thread.created_at), {
                              addSuffix: true,
                              locale: da,
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {thread.claimed_by_name && (
                          <Badge variant="secondary">
                            Claimed af {thread.claimed_by_name}
                          </Badge>
                        )}
                        <Badge className="bg-green-500">Åben</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="closed">
          <Card>
            <CardContent className="pt-6">
              {closedThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-muted-foreground">Ingen lukkede samtaler</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {closedThreads.slice(0, 20).map((thread) => (
                    <div
                      key={thread.id}
                      className="flex items-center justify-between rounded-lg border p-4 opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={thread.user_avatar ?? undefined} />
                          <AvatarFallback>
                            {thread.user_name?.slice(0, 2).toUpperCase() ?? '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{thread.user_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Lukket {thread.closed_at && formatDistanceToNow(new Date(thread.closed_at), {
                              addSuffix: true,
                              locale: da,
                            })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">Lukket</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
