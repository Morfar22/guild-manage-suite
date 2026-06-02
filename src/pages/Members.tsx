import { useState, useMemo } from 'react';
import { useDiscordMembers, DiscordMember, DiscordRole } from '@/hooks/useDiscordMembers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Search, Shield, RefreshCw, UserCog, Plus, Minus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

function intToHex(color: number): string {
  if (!color) return 'hsl(var(--muted-foreground))';
  return `#${color.toString(16).padStart(6, '0')}`;
}

function MemberRoleManager({
  member,
  allRoles,
  open,
  onOpenChange,
  onToggleRole,
  isToggling,
}: {
  member: DiscordMember;
  allRoles: DiscordRole[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleRole: (memberId: string, roleId: string, action: 'add' | 'remove') => void;
  isToggling: boolean;
}) {
  const assignableRoles = allRoles
    .filter((r) => r.name !== '@everyone' && !r.managed)
    .sort((a, b) => b.position - a.position);

  const displayName = member.nick || member.user.global_name || member.user.username;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              {member.user.avatar ? (
                <AvatarImage
                  src={`https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=64`}
                />
              ) : null}
              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {displayName}
          </DialogTitle>
          <DialogDescription>Administrer roller for dette medlem</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2 pr-4">
            {assignableRoles.map((role) => {
              const hasRole = member.roles.includes(role.id);
              return (
                <div
                  key={role.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: intToHex(role.color) }}
                    />
                    <span className="text-sm font-medium">{role.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={hasRole ? 'destructive' : 'default'}
                    disabled={isToggling}
                    onClick={() => onToggleRole(member.user.id, role.id, hasRole ? 'remove' : 'add')}
                  >
                    {hasRole ? <Minus className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                    {hasRole ? 'Fjern' : 'Tilføj'}
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function BulkRoleDialog({
  allRoles,
  members,
  open,
  onOpenChange,
  onToggleRole,
  isToggling,
}: {
  allRoles: DiscordRole[];
  members: DiscordMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleRole: (memberId: string, roleId: string, action: 'add' | 'remove') => void;
  isToggling: boolean;
}) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [running, setRunning] = useState(false);

  const assignableRoles = allRoles
    .filter((r) => r.name !== '@everyone' && !r.managed)
    .sort((a, b) => b.position - a.position);

  const handleBulk = async () => {
    if (!selectedRoleId) return;
    setRunning(true);
    let successCount = 0;
    const targets = members.filter((m) => {
      const hasRole = m.roles.includes(selectedRoleId);
      return (action === 'add' && !hasRole) || (action === 'remove' && hasRole);
    });
    for (const member of targets) {
      try {
        onToggleRole(member.user.id, selectedRoleId, action);
        successCount++;
        // Wait 1.5s between requests to respect Discord rate limits
        await new Promise((r) => setTimeout(r, 1500));
      } catch {
        // continue
      }
    }
    setRunning(false);
    toast.success(`${action === 'add' ? 'Tilføjet' : 'Fjernet'} rolle for ${successCount} medlemmer`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Masse-rolletildeling</DialogTitle>
          <DialogDescription>Tilføj eller fjern en rolle for alle viste medlemmer</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
            <SelectTrigger>
              <SelectValue placeholder="Vælg rolle" />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: intToHex(role.color) }} />
                    {role.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={(v) => setAction(v as 'add' | 'remove')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="add">Tilføj rolle</SelectItem>
              <SelectItem value="remove">Fjern rolle</SelectItem>
            </SelectContent>
          </Select>
          <Button className="w-full" onClick={handleBulk} disabled={!selectedRoleId || running || isToggling}>
            {running ? 'Arbejder...' : `Anvend på ${members.length} medlemmer`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Members() {
  const { members, roles, loading, toggleRole, refetch } = useDiscordMembers();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<DiscordMember | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const assignableRoles = useMemo(
    () => roles.filter((r: DiscordRole) => r.name !== '@everyone' && !r.managed).sort((a: DiscordRole, b: DiscordRole) => b.position - a.position),
    [roles]
  );

  const filtered = useMemo(() => {
    return members.filter((m: DiscordMember) => {
      const name = (m.nick || m.user.global_name || m.user.username).toLowerCase();
      const matchesSearch = name.includes(search.toLowerCase()) || m.user.id.includes(search);
      const matchesRole = roleFilter === 'all' || m.roles.includes(roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [members, search, roleFilter]);

  const handleToggle = (memberId: string, roleId: string, action: 'add' | 'remove') => {
    toggleRole.mutate({ memberId, roleId, action });
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div><h1 className="text-3xl font-bold">Medlemmer</h1></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Medlemmer</h1>
          <p className="text-muted-foreground mt-1">{members.length} medlemmer indlæst</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Opdater
          </Button>
          <Button size="sm" onClick={() => setBulkOpen(true)} disabled={filtered.length === 0}>
            <Shield className="h-4 w-4 mr-1" /> Masse-roller
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Søg efter navn eller ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrer på rolle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle roller</SelectItem>
            {assignableRoles.map((role: DiscordRole) => (
              <SelectItem key={role.id} value={role.id}>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: intToHex(role.color) }} />
                  {role.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Members Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((member: DiscordMember) => {
          const displayName = member.nick || member.user.global_name || member.user.username;
          const memberRoles = assignableRoles.filter((r: DiscordRole) => member.roles.includes(r.id));

          return (
            <Card
              key={member.user.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => setSelectedMember(member)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <Avatar className="h-10 w-10 shrink-0">
                  {member.user.avatar ? (
                    <AvatarImage
                      src={`https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=64`}
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">@{member.user.username}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {memberRoles.slice(0, 3).map((r: DiscordRole) => (
                      <Badge
                        key={r.id}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                        style={{ borderColor: intToHex(r.color), color: intToHex(r.color) }}
                      >
                        {r.name}
                      </Badge>
                    ))}
                    {memberRoles.length > 3 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        +{memberRoles.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
                <UserCog className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mb-3 opacity-50" />
          <p>Ingen medlemmer fundet</p>
        </div>
      )}

      {/* Member Role Manager Dialog */}
      {selectedMember && (
        <MemberRoleManager
          member={selectedMember}
          allRoles={roles}
          open={!!selectedMember}
          onOpenChange={(open) => !open && setSelectedMember(null)}
          onToggleRole={handleToggle}
          isToggling={toggleRole.isPending}
        />
      )}

      {/* Bulk Role Dialog */}
      <BulkRoleDialog
        allRoles={roles}
        members={filtered}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onToggleRole={handleToggle}
        isToggling={toggleRole.isPending}
      />
    </div>
  );
}
