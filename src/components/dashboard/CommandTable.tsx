import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CommandInfo } from '@/types/discord';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Search } from 'lucide-react';

interface CommandTableProps {
  commands: CommandInfo[];
  enabledCommands: Record<string, boolean>;
  onToggle: (commandName: string, enabled: boolean) => void;
  loading?: boolean;
}

export function CommandTable({
  commands,
  enabledCommands,
  onToggle,
  loading,
}: CommandTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search commands..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-muted-foreground w-32">Command</TableHead>
              <TableHead className="text-muted-foreground">Description</TableHead>
              <TableHead className="text-muted-foreground w-48">Usage</TableHead>
              <TableHead className="text-muted-foreground text-right w-24">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCommands.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No commands found matching "{searchQuery}"
                </TableCell>
              </TableRow>
            ) : (
              filteredCommands.map((command) => {
                const isEnabled = enabledCommands[command.name] !== false;
                return (
                  <TableRow 
                    key={command.name} 
                    className={`border-border transition-colors ${
                      isEnabled ? 'hover:bg-muted/30' : 'opacity-60 hover:bg-muted/20'
                    }`}
                  >
                    <TableCell className="font-mono">
                      <Badge 
                        variant={isEnabled ? "secondary" : "outline"} 
                        className={isEnabled ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"}
                      >
                        {command.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {command.description}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <code className="rounded bg-muted px-1.5 py-0.5">
                        {command.usage}
                      </code>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(enabled) => onToggle(command.name, enabled)}
                        disabled={loading}
                        className="data-[state=checked]:bg-primary"
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results count */}
      {searchQuery && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {filteredCommands.length} of {commands.length} commands
        </p>
      )}
    </div>
  );
}
