import { useState } from 'react';
import { useGiveaways } from '@/hooks/useGiveaways';
import { useDiscordChannels } from '@/hooks/useDiscordChannels';
import { useDiscordRoles } from '@/hooks/useDiscordRoles';
import { useGuild } from '@/contexts/GuildContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ChannelSelect } from '@/components/ui/channel-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Gift, Plus, Trophy, Users, Clock, Trash2, StopCircle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, format, addHours, addDays } from 'date-fns';
import { da } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

export default function Giveaways() {
  const { selectedGuild } = useGuild();
  const { giveaways, activeGiveaways, endedGiveaways, isLoading, createGiveaway, endGiveaway, rerollGiveaway, deleteGiveaway } = useGiveaways();
  const channelsQuery = useDiscordChannels();
  const rolesQuery = useDiscordRoles();
  
  const channels = channelsQuery.data?.channels || [];
  const roles = rolesQuery.data || [];
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    channel_id: '',
    prize: '',
    description: '',
    winners_count: 1,
    duration: '24h',
    required_role_id: '',
    customDays: 0,
    customHours: 0,
    customMinutes: 0,
  });

  const handleCreate = () => {
    if (!formData.channel_id || !formData.prize) return;

    // Calculate end time based on duration
    let endsAt: Date;
    const now = new Date();
    if (formData.duration === 'custom') {
      endsAt = new Date(now.getTime() + 
        (formData.customDays * 86400000) + 
        (formData.customHours * 3600000) + 
        (formData.customMinutes * 60000)
      );
      if (endsAt <= now) return; // must be in the future
    } else {
      switch (formData.duration) {
        case '1h': endsAt = addHours(now, 1); break;
        case '6h': endsAt = addHours(now, 6); break;
        case '12h': endsAt = addHours(now, 12); break;
        case '24h': endsAt = addDays(now, 1); break;
        case '3d': endsAt = addDays(now, 3); break;
        case '7d': endsAt = addDays(now, 7); break;
        default: endsAt = addDays(now, 1);
      }
    }

    createGiveaway.mutate({
      channel_id: formData.channel_id,
      prize: formData.prize,
      description: formData.description || undefined,
      winners_count: formData.winners_count,
      ends_at: endsAt.toISOString(),
      required_role_id: formData.required_role_id || undefined,
      host_user_id: 'dashboard',
      host_username: 'Dashboard',
    }, {
      onSuccess: () => {
        setDialogOpen(false);
        setFormData({
          channel_id: '',
          prize: '',
          description: '',
          winners_count: 1,
          duration: '24h',
          required_role_id: '',
          customDays: 0,
          customHours: 0,
          customMinutes: 0,
        });
      }
    });
  };

  const getTimeRemaining = (endsAt: string) => {
    const end = new Date(endsAt);
    if (end <= new Date()) return 'Udløbet';
    return formatDistanceToNow(end, { locale: da, addSuffix: true });
  };

  if (!selectedGuild) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Vælg en server for at administrere giveaways</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Giveaways</h1>
          <p className="text-muted-foreground">Opret og administrer giveaways for din server</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Ny Giveaway
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Opret Giveaway</DialogTitle>
              <DialogDescription>
                Opret en ny giveaway til din Discord server
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Kanal</Label>
                <ChannelSelect
                  value={formData.channel_id}
                  onValueChange={(value) => setFormData({ ...formData, channel_id: value })}
                  placeholder="Vælg kanal..."
                />
              </div>
              <div className="space-y-2">
                <Label>Præmie</Label>
                <Input
                  placeholder="f.eks. Nitro, Steam gavekort..."
                  value={formData.prize}
                  onChange={(e) => setFormData({ ...formData, prize: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Beskrivelse (valgfri)</Label>
                <Textarea
                  placeholder="Yderligere detaljer om giveawayen..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Antal vindere</Label>
                  <Select
                    value={String(formData.winners_count)}
                    onValueChange={(value) => setFormData({ ...formData, winners_count: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 5, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} vinder{n > 1 ? 'e' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Varighed</Label>
                  <Select
                    value={formData.duration}
                    onValueChange={(value) => setFormData({ ...formData, duration: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">1 time</SelectItem>
                      <SelectItem value="6h">6 timer</SelectItem>
                      <SelectItem value="12h">12 timer</SelectItem>
                      <SelectItem value="24h">24 timer</SelectItem>
                      <SelectItem value="3d">3 dage</SelectItem>
                      <SelectItem value="7d">7 dage</SelectItem>
                      <SelectItem value="custom">Brugerdefineret</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {formData.duration === 'custom' && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Dage</Label>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={formData.customDays}
                      onChange={(e) => setFormData({ ...formData, customDays: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Timer</Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={formData.customHours}
                      onChange={(e) => setFormData({ ...formData, customHours: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Minutter</Label>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={formData.customMinutes}
                      onChange={(e) => setFormData({ ...formData, customMinutes: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Påkrævet rolle (valgfri)</Label>
              <Select
                  value={formData.required_role_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, required_role_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ingen krav" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen krav</SelectItem>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuller
              </Button>
              <Button onClick={handleCreate} disabled={createGiveaway.isPending}>
                {createGiveaway.isPending ? 'Opretter...' : 'Opret Giveaway'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aktive Giveaways</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{activeGiveaways.length}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Deltagere</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">
                {giveaways?.reduce((sum, g) => sum + (g.entries?.length || 0), 0) || 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Afsluttede</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{endedGiveaways.length}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Giveaways */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Aktive Giveaways
          </CardTitle>
          <CardDescription>Giveaways der kører lige nu</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-8 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : activeGiveaways.length === 0 ? (
            <p className="text-muted-foreground">Ingen aktive giveaways</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Præmie</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead>Deltagere</TableHead>
                  <TableHead>Vindere</TableHead>
                  <TableHead>Slutter</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeGiveaways.map((giveaway) => (
                  <TableRow key={giveaway.id}>
                    <TableCell className="font-medium">{giveaway.prize}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        #{channels?.find(c => c.id === giveaway.channel_id)?.name || giveaway.channel_id}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {giveaway.entries?.length || 0}
                      </div>
                    </TableCell>
                    <TableCell>{giveaway.winners_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {getTimeRemaining(giveaway.ends_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => endGiveaway.mutate(giveaway.id)}
                        >
                          <StopCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteGiveaway.mutate(giveaway.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ended Giveaways */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Afsluttede Giveaways
          </CardTitle>
          <CardDescription>Tidligere giveaways med vindere</CardDescription>
        </CardHeader>
        <CardContent>
          {endedGiveaways.length === 0 ? (
            <p className="text-muted-foreground">Ingen afsluttede giveaways</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Præmie</TableHead>
                  <TableHead>Deltagere</TableHead>
                  <TableHead>Vindere</TableHead>
                  <TableHead>Afsluttet</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endedGiveaways.map((giveaway) => (
                  <TableRow key={giveaway.id}>
                    <TableCell className="font-medium">{giveaway.prize}</TableCell>
                    <TableCell>{giveaway.entries?.length || 0}</TableCell>
                    <TableCell>
                      {giveaway.winners?.length || 0} / {giveaway.winners_count}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(giveaway.ends_at), 'dd/MM/yyyy HH:mm', { locale: da })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          title="Reroll - træk ny vinder"
                          onClick={() => rerollGiveaway.mutate(giveaway.id)}
                          disabled={rerollGiveaway.isPending}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteGiveaway.mutate(giveaway.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
