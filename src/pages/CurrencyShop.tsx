import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ShoppingCart, Plus, Trash2, Package } from 'lucide-react';
import { useCurrencyShop } from '@/hooks/useCurrencyShop';

const CurrencyShop = () => {
  const { items, purchases, isLoading, createItem, updateItem, deleteItem } = useCurrencyShop();
  const [showCreate, setShowCreate] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: 0, role_id: '', stock: '' });

  const handleCreate = () => {
    createItem.mutate({
      name: newItem.name,
      description: newItem.description || undefined,
      price: newItem.price,
      role_id: newItem.role_id || undefined,
      stock: newItem.stock ? Number(newItem.stock) : undefined,
    }, {
      onSuccess: () => {
        setShowCreate(false);
        setNewItem({ name: '', description: '', price: 0, role_id: '', stock: '' });
      },
    });
  };

  if (isLoading) return <div className="flex items-center justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">🛒 Valuta Butik</h1>
          <p className="text-muted-foreground mt-1">Administrer butiksvarer som brugere kan købe med valuta</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Tilføj Vare</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Ny Butiksvare</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Navn</Label>
                <Input value={newItem.name} onChange={(e) => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="VIP Rolle" />
              </div>
              <div className="space-y-2">
                <Label>Beskrivelse</Label>
                <Textarea value={newItem.description} onChange={(e) => setNewItem(p => ({ ...p, description: e.target.value }))} placeholder="Få adgang til VIP-kanaler" />
              </div>
              <div className="space-y-2">
                <Label>Pris</Label>
                <Input type="number" value={newItem.price} onChange={(e) => setNewItem(p => ({ ...p, price: Number(e.target.value) }))} min={0} />
              </div>
              <div className="space-y-2">
                <Label>Rolle ID (valgfrit)</Label>
                <Input value={newItem.role_id} onChange={(e) => setNewItem(p => ({ ...p, role_id: e.target.value }))} placeholder="Tildeles ved køb" />
              </div>
              <div className="space-y-2">
                <Label>Lager (tom = ubegrænset)</Label>
                <Input type="number" value={newItem.stock} onChange={(e) => setNewItem(p => ({ ...p, stock: e.target.value }))} placeholder="Ubegrænset" min={0} />
              </div>
              <Button onClick={handleCreate} disabled={!newItem.name || createItem.isPending} className="w-full">
                {createItem.isPending ? 'Opretter...' : 'Opret Vare'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Butiksvarer ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Ingen varer i butikken endnu</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Pris</TableHead>
                  <TableHead>Lager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{item.price}</TableCell>
                    <TableCell>{item.stock !== null ? item.stock : '∞'}</TableCell>
                    <TableCell>
                      <Switch
                        checked={item.enabled}
                        onCheckedChange={(enabled) => updateItem.mutate({ id: item.id, enabled })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteItem.mutate(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Seneste Køb</CardTitle>
          <CardDescription>De seneste 50 køb</CardDescription>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Ingen køb endnu</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bruger</TableHead>
                  <TableHead>Vare</TableHead>
                  <TableHead>Pris</TableHead>
                  <TableHead>Dato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.user_name || p.user_id}</TableCell>
                    <TableCell>{p.economy_shop_items?.name || 'Ukendt'}</TableCell>
                    <TableCell className="font-mono">{p.economy_shop_items?.price || '-'}</TableCell>
                    <TableCell>{new Date(p.purchased_at).toLocaleDateString('da-DK')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CurrencyShop;
