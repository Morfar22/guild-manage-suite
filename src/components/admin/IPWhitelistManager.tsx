import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Globe, ShieldCheck, Loader2 } from 'lucide-react';
import { useIPWhitelist, useAddIPToWhitelist, useRemoveIPFromWhitelist, useCheckIPAccess } from '@/hooks/useIPWhitelist';
import { format } from 'date-fns';

export function IPWhitelistManager() {
  const [newIP, setNewIP] = useState('');
  const [description, setDescription] = useState('');

  const { data: whitelist, isLoading } = useIPWhitelist();
  const { data: ipCheck } = useCheckIPAccess();
  const addIP = useAddIPToWhitelist();
  const removeIP = useRemoveIPFromWhitelist();

  const handleAddIP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIP.trim()) return;

    addIP.mutate(
      { ip_address: newIP.trim(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          setNewIP('');
          setDescription('');
        },
      }
    );
  };

  const handleAddCurrentIP = () => {
    if (!ipCheck?.ip || ipCheck.ip === 'unknown') return;
    
    addIP.mutate({
      ip_address: ipCheck.ip,
      description: 'Min nuværende IP',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              IP Whitelist
            </CardTitle>
            <CardDescription>
              Administrer hvilke IP-adresser der har adgang til admin-panelet. Brugere med admin-rollen har altid adgang via deres konto — IP-whitelist gælder kun for staff.
            </CardDescription>
          </div>
          {ipCheck && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Din nuværende IP:</p>
              <Badge variant={ipCheck.allowed ? 'default' : 'destructive'} className="font-mono">
                {ipCheck.ip}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add IP Form */}
        <form onSubmit={handleAddIP} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ip">IP Adresse</Label>
              <Input
                id="ip"
                placeholder="192.168.1.1"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beskrivelse (valgfri)</Label>
              <Input
                id="description"
                placeholder="F.eks. Kontor, Hjemme"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={!newIP.trim() || addIP.isPending}>
              {addIP.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Tilføj IP
            </Button>
            {ipCheck?.ip && ipCheck.ip !== 'unknown' && !ipCheck.allowed && (
              <Button
                type="button"
                variant="outline"
                onClick={handleAddCurrentIP}
                disabled={addIP.isPending}
              >
                <Globe className="mr-2 h-4 w-4" />
                Tilføj min nuværende IP
              </Button>
            )}
          </div>
        </form>

        {/* Empty state info */}
        {whitelist?.length === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>Ingen IP-adresser på whitelist</p>
            <p className="text-sm">Alle admins har adgang når listen er tom</p>
          </div>
        )}

        {/* Whitelist Table */}
        {whitelist && whitelist.length > 0 && (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Adresse</TableHead>
                  <TableHead>Beskrivelse</TableHead>
                  <TableHead>Tilføjet</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : (
                  whitelist.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono">
                        <div className="flex items-center gap-2">
                          {entry.ip_address}
                          {ipCheck?.ip === entry.ip_address && (
                            <Badge variant="secondary" className="text-xs">
                              Din IP
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{entry.description || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeIP.mutate(entry.id)}
                          disabled={removeIP.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Info notice */}
        <p className="text-xs text-muted-foreground">
          Bemærk: Hvis whitelist er tom, har alle admins adgang. Så snart du tilføjer en IP, 
          vil kun whitelistede IP'er have adgang til admin-panelet.
        </p>
      </CardContent>
    </Card>
  );
}
