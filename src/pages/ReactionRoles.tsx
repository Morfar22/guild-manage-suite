import { useState } from 'react';
import { useGuild } from '@/contexts/GuildContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useReactionRoles, useReactionRolePanels } from '@/hooks/useReactionRoles';
import { useRoleMenus, RoleMenuOption } from '@/hooks/useRoleMenus';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelSelect } from '@/components/ui/channel-select';
import { Smile, Plus, Trash2, Settings, List, Send, CheckCircle2, Palette, GripVertical, Loader2 } from 'lucide-react';

export default function ReactionRoles() {
  const { selectedGuild } = useGuild();
  const { t } = useLanguage();
  const { data: reactionRoles, isLoading, addReactionRole, deleteReactionRole } = useReactionRoles();
  const { data: panels, isLoading: panelsLoading, createPanel, deletePanel, sendPanel } = useReactionRolePanels();
  const { menus, isLoading: menusLoading, createMenu, updateMenu, deleteMenu } = useRoleMenus();
  const { data: discordRoles } = useDiscordRoles();
  const { data: discordChannels } = useDiscordChannels();

  const [newRole, setNewRole] = useState({
    channel_id: '', message_id: '', emoji: '', role_id: '', description: '',
  });
  const [newPanel, setNewPanel] = useState({ title: '', description: '', color: '#5865F2' });
  const [sendChannelId, setSendChannelId] = useState<Record<string, string>>({});
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newMenu, setNewMenu] = useState({ name: '', menu_type: 'dropdown', max_roles: 0 });

  const handleSendPanel = (panelId: string) => {
    const channelId = sendChannelId[panelId];
    if (!channelId) return;
    sendPanel.mutate({ panelId, channelId });
  };

  const handleAddReactionRole = () => {
    if (!newRole.message_id || !newRole.emoji || !newRole.role_id) return;
    const role = discordRoles?.find(r => r.id === newRole.role_id);
    addReactionRole.mutate({ ...newRole, role_name: role?.name || 'Ukendt Rolle' });
    setNewRole({ channel_id: '', message_id: '', emoji: '', role_id: '', description: '' });
  };

  const handleCreatePanel = () => {
    if (!newPanel.title) return;
    createPanel.mutate(newPanel);
    setNewPanel({ title: '', description: '', color: '#5865F2' });
  };

  const handleCreateMenu = () => {
    if (!newMenu.name) return;
    createMenu.mutate(newMenu, {
      onSuccess: () => {
        setNewMenu({ name: '', menu_type: 'dropdown', max_roles: 0 });
        setCreateOpen(false);
      },
    });
  };

  if (!selectedGuild) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t('common.selectServer')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('reactionRoles.title')}</h1>
        <p className="text-muted-foreground">{t('reactionRoles.subtitle')}</p>
      </div>

      <Tabs defaultValue="roles" className="space-y-6">
        <TabsList>
          <TabsTrigger value="roles" className="gap-2">
            <Smile className="h-4 w-4" />
            {t('reactionRoles.title')}
          </TabsTrigger>
          <TabsTrigger value="panels" className="gap-2">
            <List className="h-4 w-4" />
            {t('reactionRoles.panels')}
          </TabsTrigger>
          <TabsTrigger value="menus" className="gap-2">
            <Palette className="h-4 w-4" />
            {t('nav.roleMenus')}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Reaktionsroller */}
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                {t('reactionRoles.addTitle')}
              </CardTitle>
              <CardDescription>{t('reactionRoles.addDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('reactionRoles.channelId')}</Label>
                  <Input placeholder="123456789012345678" value={newRole.channel_id} onChange={(e) => setNewRole({ ...newRole, channel_id: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('reactionRoles.messageId')}</Label>
                  <Input placeholder="123456789012345678" value={newRole.message_id} onChange={(e) => setNewRole({ ...newRole, message_id: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('reactionRoles.emoji')}</Label>
                  <Input placeholder="🎮" value={newRole.emoji} onChange={(e) => setNewRole({ ...newRole, emoji: e.target.value })} />
                  <p className="text-xs text-muted-foreground">{t('reactionRoles.emojiHelp')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('common.role')}</Label>
                  <Select value={newRole.role_id} onValueChange={(value) => setNewRole({ ...newRole, role_id: value })}>
                    <SelectTrigger><SelectValue placeholder={t('common.selectRole')} /></SelectTrigger>
                    <SelectContent>
                      {discordRoles?.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `#${role.color.toString(16).padStart(6, '0')}` }} />
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('reactionRoles.descOptional')}</Label>
                <Input placeholder={t('reactionRoles.descPlaceholder')} value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} />
              </div>
              <Button onClick={handleAddReactionRole} disabled={!newRole.message_id || !newRole.emoji || !newRole.role_id}>
                <Plus className="h-4 w-4 mr-2" />
                {t('reactionRoles.addTitle')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('reactionRoles.activeTitle')}</CardTitle>
              <CardDescription>{t('reactionRoles.activeDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : reactionRoles && reactionRoles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reactionRoles.emoji')}</TableHead>
                      <TableHead>{t('common.role')}</TableHead>
                      <TableHead>{t('reactionRoles.messageId')}</TableHead>
                      <TableHead>{t('common.description')}</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reactionRoles.map((rr) => (
                      <TableRow key={rr.id}>
                        <TableCell className="text-2xl">{rr.emoji}</TableCell>
                        <TableCell><Badge variant="secondary">{rr.role_name || rr.role_id}</Badge></TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{rr.message_id}</TableCell>
                        <TableCell className="text-muted-foreground">{rr.description || '-'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteReactionRole.mutate(rr.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Smile className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('reactionRoles.noRoles')}</p>
                  <p className="text-sm mt-2">{t('reactionRoles.addAbove')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Paneler */}
        <TabsContent value="panels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t('reactionRoles.createPanel')}
              </CardTitle>
              <CardDescription>{t('reactionRoles.createPanelDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('reactionRoles.panelTitle')}</Label>
                <Input placeholder="Rolle-menu" value={newPanel.title} onChange={(e) => setNewPanel({ ...newPanel, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('reactionRoles.panelDesc')}</Label>
                <Textarea placeholder="Reager på beskederne nedenfor for at få roller" value={newPanel.description} onChange={(e) => setNewPanel({ ...newPanel, description: e.target.value })} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>{t('reactionRoles.panelColor')}</Label>
                <div className="flex gap-2">
                  <Input type="color" value={newPanel.color} onChange={(e) => setNewPanel({ ...newPanel, color: e.target.value })} className="w-16 h-10 p-1" />
                  <Input value={newPanel.color} onChange={(e) => setNewPanel({ ...newPanel, color: e.target.value })} placeholder="#5865F2" className="flex-1" />
                </div>
              </div>
              <Button onClick={handleCreatePanel} disabled={!newPanel.title}>
                <Plus className="h-4 w-4 mr-2" />
                {t('reactionRoles.createPanel')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('reactionRoles.panelsTitle')}</CardTitle>
              <CardDescription>{t('reactionRoles.panelsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {panelsLoading ? (
                <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : panels && panels.length > 0 ? (
                <div className="space-y-4">
                  {panels.map((panel) => (
                    <div key={panel.id} className="p-4 rounded-lg border space-y-3" style={{ borderLeftColor: panel.color || '#5865F2', borderLeftWidth: 4 }}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{panel.title}</h4>
                          <p className="text-sm text-muted-foreground">{panel.description || t('reactionRoles.noDesc')}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deletePanel.mutate(panel.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {panel.message_id && (
                          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                            <CheckCircle2 className="h-4 w-4" />
                            {t('reactionRoles.panelSent', { id: panel.message_id })}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <ChannelSelect
                            value={sendChannelId[panel.id] || panel.channel_id || ''}
                            onValueChange={(value) => setSendChannelId(prev => ({ ...prev, [panel.id]: value }))}
                            placeholder={t('common.selectChannel')}
                          />
                          <Button onClick={() => handleSendPanel(panel.id)} disabled={!(sendChannelId[panel.id] || panel.channel_id) || sendPanel.isPending} className="gap-2">
                            <Send className="h-4 w-4" />
                            {sendPanel.isPending ? t('reactionRoles.sending') : (panel.message_id ? t('reactionRoles.resend') : t('reactionRoles.sendPanel'))}
                          </Button>
                        </div>
                        {panel.message_id && (
                          <p className="text-xs text-muted-foreground">{t('reactionRoles.resendTip')}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('reactionRoles.noPanels')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Role Menus */}
        <TabsContent value="menus" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{t('nav.roleMenus')}</h2>
              <p className="text-sm text-muted-foreground">{t('roleMenus.subtitle')}</p>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" /> {t('roleMenus.new')}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t('roleMenus.create')}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('reactionRoles.panelTitle')}</Label>
                    <Input value={newMenu.name} onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })} placeholder={t('roleMenus.titlePlaceholder')} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('common.type')}</Label>
                      <Select value={newMenu.menu_type} onValueChange={(v) => setNewMenu({ ...newMenu, menu_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dropdown">Dropdown</SelectItem>
                          <SelectItem value="buttons">{t('roleMenus.buttons')}</SelectItem>
                          <SelectItem value="reactions">{t('roleMenus.reactions')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('roleMenus.maxRoles')}</Label>
                      <Input type="number" min={0} value={newMenu.max_roles} onChange={(e) => setNewMenu({ ...newMenu, max_roles: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <Button onClick={handleCreateMenu} disabled={!newMenu.name || createMenu.isPending} className="w-full">
                    {createMenu.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                    {t('common.create')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {menusLoading ? (
            <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
          ) : menus.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Palette className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">{t('roleMenus.noMenus')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('roleMenus.noMenusDesc')}</p>
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
        </TabsContent>
      </Tabs>
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
  const { t } = useLanguage();
  const [addRoleId, setAddRoleId] = useState('');
  const [addEmoji, setAddEmoji] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const roles: RoleMenuOption[] = menu.roles || [];

  const handleAddRole = () => {
    if (!addRoleId) return;
    const role = discordRoles.find((r: any) => r.id === addRoleId);
    onUpdate([...roles, {
      role_id: addRoleId,
      role_name: role?.name || 'Unknown',
      emoji: addEmoji || undefined,
      label: addLabel || role?.name || undefined,
    }]);
    setAddRoleId('');
    setAddEmoji('');
    setAddLabel('');
  };

  const handleRemoveRole = (index: number) => {
    onUpdate(roles.filter((_, i) => i !== index));
  };

  return (
    <Card className={isSelected ? 'ring-2 ring-primary' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="cursor-pointer flex-1" onClick={onSelect}>
            <CardTitle className="text-lg">{menu.name}</CardTitle>
            <CardDescription>{roles.length} {t('roleMenus.rolesCount')} · {menu.menu_type}</CardDescription>
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
            <h4 className="text-sm font-medium mb-3">{t('roleMenus.rolesInMenu')}</h4>
            {roles.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('roleMenus.noRolesAdded')}</p>
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
              <h5 className="text-xs font-medium text-muted-foreground">{t('roleMenus.addRole')}</h5>
              <div className="grid grid-cols-3 gap-2">
                <Select value={addRoleId} onValueChange={setAddRoleId}>
                  <SelectTrigger><SelectValue placeholder={t('common.selectRole')} /></SelectTrigger>
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
                <Input placeholder={`${t('reactionRoles.emoji')} 🎮`} value={addEmoji} onChange={(e) => setAddEmoji(e.target.value)} />
                <Input placeholder="Label" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} />
              </div>
              <Button size="sm" onClick={handleAddRole} disabled={!addRoleId}>
                <Plus className="h-3.5 w-3.5 mr-1" /> {t('common.add')}
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
