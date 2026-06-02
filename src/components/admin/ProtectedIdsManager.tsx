import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldOff, Plus, Trash2 } from 'lucide-react';
import { useProtectedIds } from '@/hooks/useProtectedIds';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

export function ProtectedIdsManager() {
  const { protectedIds, isLoading, addProtectedId, removeProtectedId } = useProtectedIds();
  const [newDiscordId, setNewDiscordId] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    const trimmed = newDiscordId.trim();
    if (!trimmed) return;
    addProtectedId.mutate({ discord_id: trimmed, label: newLabel.trim() || undefined }, {
      onSuccess: () => { setNewDiscordId(''); setNewLabel(''); }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldOff className="h-5 w-5" />
          Beskyttede Discord IDs
        </CardTitle>
        <CardDescription>
          Disse Discord IDs kan ikke roastes af andre brugere via AI Chat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Discord ID"
            value={newDiscordId}
            onChange={(e) => setNewDiscordId(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Label (valgfrit)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={!newDiscordId.trim() || addProtectedId.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Tilføj
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : protectedIds.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Ingen beskyttede IDs endnu</p>
        ) : (
          <div className="space-y-2">
            {protectedIds.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{item.discord_id}</code>
                  {item.label && <Badge variant="secondary">{item.label}</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: da })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeProtectedId.mutate(item.id)}
                  disabled={removeProtectedId.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
