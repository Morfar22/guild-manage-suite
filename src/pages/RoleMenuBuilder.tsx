import { useState } from 'react';
import { useRoleMenus, RoleMenuOption } from '@/hooks/useRoleMenus';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Palette, GripVertical, Loader2 } from 'lucide-react';

export default function RoleMenuBuilder() {
  const { menus, isLoading, createMenu, updateMenu, deleteMenu } = useRoleMenus();
  const { data: discordRoles } = useDiscordRoles();
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newMenu, setNewMenu] = useState({ name: '', menu_type: 'dropdown', max_roles: 0 });

  const handleCreate = () => {
    if (!newMenu.name) return;
    createMenu.mutate(newMenu, {
      onSuccess: () => {
        setNewMenu({ name: '', menu_type: 'dropdown', max_roles: 0 });
        setCreateOpen(false);
      },
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Palette className="h-8 w-8" /> Role Menu Builder
          </h1>
          <p className="text-muted-foreground">Opret visuelle rolle-menuer til din server</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Ny Role Menu</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Opret Role Menu</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Titel</Label>
                <Input value={newMenu.name} onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })} placeholder="Vælg dine roller" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newMenu.menu_type} onValueChange={(v) => setNewMenu({ ...newMenu, menu_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                      <SelectItem value="buttons">Knapper</SelectItem>
                      <SelectItem value="reactions">Reaktioner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Maks roller (0 = ubegrænset)</Label>
                  <Input type="number" min={0} value={newMenu.max_roles} onChange={(e) => setNewMenu({ ...newMenu, max_roles: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={!newMenu.name || createMenu.isPending} className="w-full">
                {createMenu.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Opret
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : menus.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Palette className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">Ingen role menus endnu</p>
            <p className="text-sm text-muted-foreground mt-1">Opret en for at lade brugere vælge roller</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {menus.map((menu) => (
            <RoleMenuCard
              key={menu.id}
              menu={menu}
              discordRoles={discordRoles ?? []}
              isSelected={selectedMenuId === menu.id}
              onSelect={() => setSelectedMenuId(selectedMenuId === menu.id ? null : menu.id)}
              onDelete={() => deleteMenu.mutate(menu.id)}
              onUpdate={(roles) => updateMenu.mutate({ id: menu.id, roles })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoleMenuCard({ menu, discordRoles, isSelected, onSelect, onDelete, onUpdate }: {
  menu: any;
  discordRoles: any[];
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (roles: RoleMenuOption[]) => void;
}) {
  const [addRoleId, setAddRoleId] = useState('');
  const [addEmoji, setAddEmoji] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const roles: RoleMenuOption[] = menu.roles || [];

  const handleAddRole = () => {
    if (!addRoleId) return;
    const role = discordRoles.find((r: any) => r.id === addRoleId);
    const newRoles = [...roles, {
      role_id: addRoleId,
      role_name: role?.name || 'Unknown',
      emoji: addEmoji || undefined,
      label: addLabel || role?.name || undefined,
    }];
    onUpdate(newRoles);
    setAddRoleId('');
    setAddEmoji('');
    setAddLabel('');
  };

  const handleRemoveRole = (index: number) => {
    const newRoles = roles.filter((_, i) => i !== index);
    onUpdate(newRoles);
  };

  return (
    <Card className={isSelected ? 'ring-2 ring-primary' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="cursor-pointer flex-1" onClick={onSelect}>
            <CardTitle className="text-lg">{menu.name}</CardTitle>
            <CardDescription>{roles.length} roller · {menu.menu_type}</CardDescription>
          </div>
          <div className="flex gap-1">
            <Badge variant="outline">{menu.menu_type}</Badge>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isSelected && (
        <CardContent className="space-y-4 pt-0">
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium mb-3">Roller i denne menu</h4>
            {roles.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Ingen roller tilføjet endnu</p>
            ) : (
              <div className="space-y-2">
                {roles.map((opt, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      {opt.emoji && <span className="text-lg">{opt.emoji}</span>}
                      <span className="text-sm font-medium">{opt.label || opt.role_name}</span>
                      <Badge variant="secondary" className="text-xs">{opt.role_name}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveRole(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 space-y-3 p-3 rounded-lg border border-dashed border-border">
              <h5 className="text-xs font-medium text-muted-foreground">Tilføj rolle</h5>
              <div className="grid grid-cols-3 gap-2">
                <Select value={addRoleId} onValueChange={setAddRoleId}>
                  <SelectTrigger><SelectValue placeholder="Rolle..." /></SelectTrigger>
                  <SelectContent>
                    {discordRoles.map((role: any) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `#${role.color.toString(16).padStart(6, '0')}` }} />
                          {role.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Emoji 🎮" value={addEmoji} onChange={(e) => setAddEmoji(e.target.value)} />
                <Input placeholder="Label" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} />
              </div>
              <Button size="sm" onClick={handleAddRole} disabled={!addRoleId}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Tilføj
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
