import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, X, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAutomodBypassRoles } from '@/hooks/useAutomodBypass';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';

export function AutomodBypassRolesCard() {
  const { data: bypassRoles, update, isLoading } = useAutomodBypassRoles();
  const { data: discordRoles } = useDiscordRoles();
  const [pending, setPending] = useState<string[]>([]);
  const [picker, setPicker] = useState<string>('');

  useEffect(() => {
    if (bypassRoles) setPending(bypassRoles);
  }, [bypassRoles]);

  const dirty = JSON.stringify([...pending].sort()) !== JSON.stringify([...(bypassRoles ?? [])].sort());

  const addRole = (id: string) => {
    if (!id || pending.includes(id)) return;
    setPending([...pending, id]);
    setPicker('');
  };

  const removeRole = (id: string) => setPending(pending.filter((r) => r !== id));

  const roleName = (id: string) => discordRoles?.find((r) => r.id === id)?.name ?? id;
  const availableRoles = (discordRoles ?? []).filter((r) => !pending.includes(r.id) && r.name !== '@everyone');

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Automod Bypass-roller
        </CardTitle>
        <CardDescription>
          Brugere med en af disse roller bliver <strong>ignoreret af ALLE automod-systemer</strong> –
          regler, AI toxicity, raid protection, anti-spam, alt-detection osv. Brug til staff/trusted-roller.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 min-h-[2rem]">
          {pending.length === 0 && (
            <span className="text-sm text-muted-foreground">Ingen bypass-roller tilføjet.</span>
          )}
          {pending.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
              {roleName(id)}
              <button
                type="button"
                onClick={() => removeRole(id)}
                className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
                aria-label="Fjern"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Select value={picker} onValueChange={addRole}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Tilføj rolle…" />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.length === 0 ? (
                <SelectItem value="__none" disabled>Ingen flere roller</SelectItem>
              ) : (
                availableRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            disabled={!dirty || isLoading || update.isPending}
            onClick={() => update.mutate(pending)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Gem
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
