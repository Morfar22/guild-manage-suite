import { useState, useEffect } from 'react';
import { PremiumGate } from '@/components/premium/PremiumGate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useJTCSettings } from '@/hooks/useJTCSettings';
import { useJTCTriggers } from '@/hooks/useJTCTriggers';
import { Loader2, Mic, Users, Clock, RefreshCw, Trash2, Hash, Settings2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { JTCTriggerCard } from '@/components/jtc/JTCTriggerCard';
import { CreateJTCTriggerDialog } from '@/components/jtc/CreateJTCTriggerDialog';

export default function JTCSettings() {
  return (
    <PremiumGate feature="jtc">
      <JTCSettingsContent />
    </PremiumGate>
  );
}

function JTCSettingsContent() {
  const { settings, activeChannels, isLoading: isLoadingSettings, updateSettings, deleteChannel, refetchChannels, isRefetchingChannels } = useJTCSettings();
  const { triggers, isLoading: isLoadingTriggers, createTrigger, updateTrigger, deleteTrigger } = useJTCTriggers();
  const { data: channelData } = useDiscordChannels();
  const { data: rolesData } = useDiscordRoles();

  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
    }
  }, [settings]);

  const handleToggleEnabled = (checked: boolean) => {
    setEnabled(checked);
    updateSettings.mutate({ enabled: checked });
  };

  // Get voice channels, categories, and roles
  const voiceChannels = channelData?.channels?.filter(c => c.type === 2) || [];
  const categories = channelData?.categories || [];
  const roles = rolesData || [];
  
  const existingTriggerChannels = triggers.map(t => t.trigger_channel_id);

  const isLoading = isLoadingSettings || isLoadingTriggers;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Join to Create</h1>
            <p className="text-muted-foreground mt-1">
              Lad brugere oprette deres egne midlertidige voice kanaler
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="jtc-enabled"
                checked={enabled}
                onCheckedChange={handleToggleEnabled}
              />
              <Label htmlFor="jtc-enabled">JTC Aktiv</Label>
            </div>
            <CreateJTCTriggerDialog
              voiceChannels={voiceChannels}
              categories={categories}
              roles={roles}
              onCreate={(input) => createTrigger.mutate(input)}
              isCreating={createTrigger.isPending}
              existingTriggerChannels={existingTriggerChannels}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Triggers Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">JTC Triggers</h2>
              <span className="text-sm text-muted-foreground">({triggers.length})</span>
            </div>

            {triggers.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Mic className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Ingen JTC triggers oprettet</p>
                  <p className="text-sm">
                    Klik på "Ny JTC Trigger" for at komme i gang
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {triggers.map((trigger) => (
                  <JTCTriggerCard
                    key={trigger.id}
                    trigger={trigger}
                    voiceChannels={voiceChannels}
                    categories={categories}
                    roles={roles}
                    onUpdate={(input) => updateTrigger.mutate(input)}
                    onDelete={(id) => deleteTrigger.mutate(id)}
                    isUpdating={updateTrigger.isPending}
                    isDeleting={deleteTrigger.isPending}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Active Channels Card */}
          <Card className="bg-card border-border h-fit">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Aktive Kanaler
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {activeChannels.length} aktive
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Oversigt over midlertidige voice kanaler
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchChannels()}
                  disabled={isRefetchingChannels}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefetchingChannels ? 'animate-spin' : ''}`} />
                  Genindlæs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {activeChannels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mic className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Ingen aktive JTC kanaler</p>
                  <p className="text-sm">
                    Kanaler vises her når brugere opretter dem
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kanal</TableHead>
                      <TableHead>Ejer</TableHead>
                      <TableHead>Brugere</TableHead>
                      <TableHead>Oprettet</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeChannels.map((channel) => (
                      <TableRow key={channel.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            {channel.channel_name || `Kanal ${channel.channel_id.slice(-4)}`}
                          </div>
                        </TableCell>
                        <TableCell>
                          {channel.owner_name || channel.owner_id}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {channel.member_count ?? 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(channel.created_at), {
                              addSuffix: true,
                              locale: da
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Slet kanal?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Dette vil permanent slette voice kanalen fra Discord.
                                  Alle brugere i kanalen vil blive afbrudt.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteChannel.mutate(channel.channel_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deleteChannel.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Slet'
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* How it works */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Sådan fungerer det</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium">Opret triggers</p>
                  <p className="text-sm text-muted-foreground">
                    Konfigurer flere trigger kanaler med forskellige roller
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium">Bruger joiner trigger</p>
                  <p className="text-sm text-muted-foreground">
                    Når en bruger joiner en trigger kanal
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium">Kanal oprettes</p>
                  <p className="text-sm text-muted-foreground">
                    Botten opretter en ny voice kanal
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                  4
                </div>
                <div>
                  <p className="font-medium">Auto-sletning</p>
                  <p className="text-sm text-muted-foreground">
                    Kanalen slettes når alle forlader den
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
