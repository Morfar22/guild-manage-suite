import { Settings2, TimerReset, ShieldCheck, Hash } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CommandInfo } from '@/types/discord';
import { GuildCommandSettings } from '@/lib/commands';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CommandTableProps {
  commands: CommandInfo[];
  commandSettings: Record<string, GuildCommandSettings>;
  onToggle: (commandName: string, enabled: boolean) => void;
  onConfigure: (command: CommandInfo) => void;
  loading?: boolean;
}

export function CommandTable({
  commands,
  commandSettings,
  onToggle,
  onConfigure,
  loading,
}: CommandTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="text-muted-foreground w-36">Command</TableHead>
            <TableHead className="text-muted-foreground">Beskrivelse</TableHead>
            <TableHead className="text-muted-foreground w-48">Begrænsninger</TableHead>
            <TableHead className="text-muted-foreground w-48">Brug</TableHead>
            <TableHead className="text-muted-foreground text-right w-40">Kontrol</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {commands.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                Ingen commands matcher dine filtre.
              </TableCell>
            </TableRow>
          ) : (
            commands.map((command) => {
              const settings = commandSettings[command.name];
              const isEnabled = settings?.enabled !== false;
              const cooldown = settings?.cooldown_seconds ?? 0;
              const roleCount = settings?.allowed_role_ids?.length ?? 0;
              const channelCount = settings?.allowed_channel_ids?.length ?? 0;
              const hasRestrictions = cooldown > 0 || roleCount > 0 || channelCount > 0;

              return (
                <TableRow
                  key={command.name}
                  className={`border-border transition-colors ${isEnabled ? 'hover:bg-muted/30' : 'opacity-60 hover:bg-muted/20'}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={isEnabled ? 'secondary' : 'outline'} className="font-mono">
                        /{command.name}
                      </Badge>
                      {hasRestrictions && <span className="h-2 w-2 rounded-full bg-primary" title="Har særlige regler" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-foreground">{command.description}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">{command.category}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {cooldown > 0 && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <TimerReset className="h-3 w-3" /> {cooldown}s
                        </Badge>
                      )}
                      {roleCount > 0 && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <ShieldCheck className="h-3 w-3" /> {roleCount} roller
                        </Badge>
                      )}
                      {channelCount > 0 && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Hash className="h-3 w-3" /> {channelCount} kanaler
                        </Badge>
                      )}
                      {!hasRestrictions && <span className="text-xs text-muted-foreground">Ingen</span>}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5">{command.usage}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onConfigure(command)} title="Indstillinger">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(enabled) => onToggle(command.name, enabled)}
                        disabled={loading}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
