import { useMemo, useState } from 'react';
import { Copy, Loader2, ShieldCheck, TimerReset, Users } from 'lucide-react';
import { COMMANDS_BY_CATEGORY, CommandCategory } from '@/types/discord';
import { GuildCommandSettings } from '@/lib/commands';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  commandSettings: Record<string, GuildCommandSettings>;
  updating?: boolean;
  onUpdateCommand: (
    commandName: string,
    updates: Partial<Pick<GuildCommandSettings, 'cooldown_seconds' | 'allowed_role_ids' | 'allowed_channel_ids'>>
  ) => Promise<void>;
  onBulkUpdate: (
    commandNames: string[],
    updates: Partial<Pick<GuildCommandSettings, 'enabled' | 'cooldown_seconds' | 'allowed_role_ids' | 'allowed_channel_ids'>>
  ) => Promise<void>;
  onCopyRules: (sourceCommand: string, targetCommands: string[]) => Promise<void>;
}

export function CommandPermissionsMatrix({
  commandSettings,
  updating,
  onUpdateCommand,
  onBulkUpdate,
  onCopyRules,
}: Props) {
  const { data: roles = [], isLoading } = useDiscordRoles();
  const categories = Object.keys(COMMANDS_BY_CATEGORY) as CommandCategory[];

  const [category, setCategory] = useState<CommandCategory>('moderation');
  const [selectedCommands, setSelectedCommands] = useState<string[]>([]);
  const [bulkRoleId, setBulkRoleId] = useState('');
  const [bulkCooldown, setBulkCooldown] = useState(0);
  const [copySource, setCopySource] = useState('');

  const commands = COMMANDS_BY_CATEGORY[category] ?? [];
  const selectableRoles = useMemo(
    () => roles.filter((role) => role.name !== '@everyone'),
    [roles]
  );

  const allSelected = commands.length > 0 && commands.every((command) => selectedCommands.includes(command.name));

  const toggleCommandSelection = (commandName: string) => {
    setSelectedCommands((current) =>
      current.includes(commandName)
        ? current.filter((name) => name !== commandName)
        : [...current, commandName]
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedCommands((current) => current.filter((name) => !commands.some((command) => command.name === name)));
    } else {
      setSelectedCommands((current) => [
        ...new Set([...current, ...commands.map((command) => command.name)]),
      ]);
    }
  };

  const toggleRole = async (commandName: string, roleId: string) => {
    const current = commandSettings[commandName]?.allowed_role_ids ?? [];
    const next = current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId];

    await onUpdateCommand(commandName, { allowed_role_ids: next });
  };

  const setUnrestricted = async (commandName: string) => {
    await onUpdateCommand(commandName, { allowed_role_ids: [] });
  };

  const selectedInCategory = selectedCommands.filter((name) =>
    commands.some((command) => command.name === name)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Permissions Matrix
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Begræns commands til bestemte Discord-roller og redigér flere commands på én gang.
          </p>
        </div>

        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value as CommandCategory);
            setSelectedCommands([]);
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((item) => (
              <SelectItem key={item} value={item}>
                <span className="capitalize">{item}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedInCategory.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge>{selectedInCategory.length} valgt</Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={updating}
              onClick={() => void onBulkUpdate(selectedInCategory, { enabled: true })}
            >
              Aktiver
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={updating}
              onClick={() => void onBulkUpdate(selectedInCategory, { enabled: false })}
            >
              Deaktiver
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={updating}
              onClick={() => void onBulkUpdate(selectedInCategory, { allowed_role_ids: [] })}
            >
              <Users className="mr-1.5 h-4 w-4" />
              Alle roller
            </Button>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <div className="flex gap-2">
              <Select value={bulkRoleId} onValueChange={setBulkRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg rolle" />
                </SelectTrigger>
                <SelectContent>
                  {selectableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={updating || !bulkRoleId}
                onClick={() => void onBulkUpdate(selectedInCategory, { allowed_role_ids: [bulkRoleId] })}
                className="whitespace-nowrap"
              >
                Kun denne rolle
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                max={86400}
                value={bulkCooldown}
                onChange={(event) => setBulkCooldown(Math.max(0, Math.min(86400, Number(event.target.value) || 0)))}
                placeholder="Cooldown"
              />
              <Button
                variant="outline"
                disabled={updating}
                onClick={() => void onBulkUpdate(selectedInCategory, { cooldown_seconds: bulkCooldown })}
                className="whitespace-nowrap"
              >
                <TimerReset className="mr-1.5 h-4 w-4" />
                Sæt cooldown
              </Button>
            </div>

            <div className="flex gap-2">
              <Select value={copySource} onValueChange={setCopySource}>
                <SelectTrigger>
                  <SelectValue placeholder="Kopiér regler fra..." />
                </SelectTrigger>
                <SelectContent>
                  {commands.map((command) => (
                    <SelectItem key={command.name} value={command.name}>/{command.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                disabled={updating || !copySource}
                onClick={() => void onCopyRules(copySource, selectedInCategory)}
                className="whitespace-nowrap"
              >
                <Copy className="mr-1.5 h-4 w-4" />
                Kopiér regler
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <div
                className="grid border-b border-border bg-muted/40"
                style={{ gridTemplateColumns: `48px 190px 110px repeat(${selectableRoles.length}, 150px)` }}
              >
                <div className="flex items-center justify-center p-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </div>
                <div className="p-3 text-xs font-medium text-muted-foreground">Command</div>
                <div className="p-3 text-center text-xs font-medium text-muted-foreground">Alle</div>
                {selectableRoles.map((role) => (
                  <div key={role.id} className="truncate border-l border-border p-3 text-center text-xs font-medium text-muted-foreground">
                    {role.name}
                  </div>
                ))}
              </div>

              {commands.map((command) => {
                const settings = commandSettings[command.name];
                const roleIds = settings?.allowed_role_ids ?? [];
                const unrestricted = roleIds.length === 0;
                const enabled = settings?.enabled !== false;

                return (
                  <div
                    key={command.name}
                    className="grid border-b border-border last:border-b-0 hover:bg-muted/20"
                    style={{ gridTemplateColumns: `48px 190px 110px repeat(${selectableRoles.length}, 150px)` }}
                  >
                    <div className="flex items-center justify-center p-3">
                      <Checkbox
                        checked={selectedCommands.includes(command.name)}
                        onCheckedChange={() => toggleCommandSelection(command.name)}
                      />
                    </div>
                    <div className="flex items-center gap-2 p-3">
                      <Badge variant={enabled ? 'secondary' : 'outline'} className="font-mono">
                        /{command.name}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-center p-2">
                      <Button
                        variant={unrestricted ? 'default' : 'outline'}
                        size="sm"
                        disabled={updating}
                        onClick={() => void setUnrestricted(command.name)}
                        title="Tillad alle roller"
                      >
                        <Users className="mr-1 h-3.5 w-3.5" />
                        Alle
                      </Button>
                    </div>
                    {selectableRoles.map((role) => {
                      const checked = roleIds.includes(role.id);
                      return (
                        <label
                          key={role.id}
                          className="flex cursor-pointer items-center justify-center border-l border-border p-3 hover:bg-muted/40"
                          title={unrestricted ? 'Commanden er åben for alle. Klik for kun at tillade denne rolle.' : role.name}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={updating}
                            onCheckedChange={() => void toggleRole(command.name, role.id)}
                          />
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        “Alle” betyder, at commanden ikke har nogen rollebegrænsning. Vælger du én eller flere roller, er det kun de roller der får adgang.
      </p>
    </div>
  );
}
