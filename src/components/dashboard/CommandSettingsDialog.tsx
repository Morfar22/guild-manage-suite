import { useEffect, useMemo, useState } from 'react';
import { Settings2, ShieldCheck, Hash, TimerReset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { CommandInfo } from '@/types/discord';
import { GuildCommandSettings } from '@/lib/commands';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: CommandInfo | null;
  settings?: GuildCommandSettings;
  saving?: boolean;
  onSave: (
    commandName: string,
    updates: Pick<GuildCommandSettings, 'cooldown_seconds' | 'allowed_role_ids' | 'allowed_channel_ids'>
  ) => Promise<void>;
}

export function CommandSettingsDialog({
  open,
  onOpenChange,
  command,
  settings,
  saving,
  onSave,
}: Props) {
  const { data: roles = [], isLoading: rolesLoading } = useDiscordRoles();
  const { data: channelData, isLoading: channelsLoading } = useDiscordChannels();
  const channels = channelData?.channels ?? [];

  const [cooldown, setCooldown] = useState(0);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [channelIds, setChannelIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setCooldown(settings?.cooldown_seconds ?? 0);
    setRoleIds(settings?.allowed_role_ids ?? []);
    setChannelIds(settings?.allowed_channel_ids ?? []);
  }, [open, settings]);

  const selectableRoles = useMemo(
    () => roles.filter((role) => role.name !== '@everyone'),
    [roles]
  );

  const toggleValue = (
    value: string,
    values: string[],
    setter: (next: string[]) => void
  ) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const handleSave = async () => {
    if (!command) return;
    await onSave(command.name, {
      cooldown_seconds: Math.max(0, Math.min(86400, Number(cooldown) || 0)),
      allowed_role_ids: roleIds,
      allowed_channel_ids: channelIds,
    });
    onOpenChange(false);
  };

  if (!command) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            /{command.name}
          </DialogTitle>
          <DialogDescription>
            Styr cooldown og hvor kommandoen må bruges. Tomme rolle- og kanallister betyder ingen begrænsning.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2 md:grid-cols-2">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="command-cooldown" className="flex items-center gap-2">
                <TimerReset className="h-4 w-4" />
                Cooldown
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="command-cooldown"
                  type="number"
                  min={0}
                  max={86400}
                  value={cooldown}
                  onChange={(event) => setCooldown(Number(event.target.value))}
                />
                <span className="whitespace-nowrap text-sm text-muted-foreground">sekunder</span>
              </div>
              <p className="text-xs text-muted-foreground">
                0 deaktiverer cooldown. Maksimum er 24 timer.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Tilladte roller
                </Label>
                <Badge variant="secondary">{roleIds.length || 'Alle'}</Badge>
              </div>
              <ScrollArea className="h-60 rounded-lg border border-border">
                <div className="space-y-1 p-3">
                  {rolesLoading ? (
                    <p className="p-2 text-sm text-muted-foreground">Henter roller...</p>
                  ) : selectableRoles.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">Ingen roller fundet.</p>
                  ) : (
                    selectableRoles.map((role) => (
                      <label
                        key={role.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                      >
                        <Checkbox
                          checked={roleIds.includes(role.id)}
                          onCheckedChange={() => toggleValue(role.id, roleIds, setRoleIds)}
                        />
                        <span className="truncate text-sm">{role.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
              {roleIds.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setRoleIds([])}>
                  Tillad alle roller
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Tilladte kanaler
              </Label>
              <Badge variant="secondary">{channelIds.length || 'Alle'}</Badge>
            </div>
            <ScrollArea className="h-[352px] rounded-lg border border-border">
              <div className="space-y-1 p-3">
                {channelsLoading ? (
                  <p className="p-2 text-sm text-muted-foreground">Henter kanaler...</p>
                ) : channels.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">Ingen kanaler fundet.</p>
                ) : (
                  channels.map((channel) => (
                    <label
                      key={channel.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={channelIds.includes(channel.id)}
                        onCheckedChange={() => toggleValue(channel.id, channelIds, setChannelIds)}
                      />
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate text-sm">{channel.name}</span>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
            {channelIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setChannelIds([])}>
                Tillad alle kanaler
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Gemmer...' : 'Gem indstillinger'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
