import { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCharacters, useCharacterStats, useCreateCharacter, useUpdateCharacter, useDeleteCharacter, CharacterStatus, Character } from '@/hooks/useCharacters';
import { useGuild } from '@/contexts/GuildContext';
import { useToast } from '@/hooks/use-toast';
import { Users, Heart, Skull, UserX, Search, User, Plus, Pencil, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

function StatusBadge({ status }: { status: CharacterStatus }) {
  const config = {
    alive: { label: 'I Live', variant: 'default' as const, icon: Heart },
    dead: { label: 'Død', variant: 'destructive' as const, icon: Skull },
    retired: { label: 'Pensioneret', variant: 'secondary' as const, icon: UserX },
  };

  const { label, variant, icon: Icon } = config[status];

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

interface CharacterFormData {
  discord_user_id: string;
  discord_username: string;
  name: string;
  age: number | null;
  background: string;
  faction: string;
  occupation: string;
  appearance: string;
  status: CharacterStatus;
}

const emptyForm: CharacterFormData = {
  discord_user_id: '',
  discord_username: '',
  name: '',
  age: null,
  background: '',
  faction: '',
  occupation: '',
  appearance: '',
  status: 'alive',
};

export default function Characters() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CharacterStatus | undefined>();
  
  const { data: stats, isLoading: statsLoading } = useCharacterStats();
  const { data: characters, isLoading } = useCharacters(statusFilter);
  const { selectedGuild } = useGuild();
  const { toast } = useToast();
  
  const createCharacter = useCreateCharacter();
  const updateCharacter = useUpdateCharacter();
  const deleteCharacter = useDeleteCharacter();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [formData, setFormData] = useState<CharacterFormData>(emptyForm);

  const filteredCharacters = characters?.filter(char =>
    char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    char.discord_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    char.faction?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingCharacter(null);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleEdit = (character: Character) => {
    setEditingCharacter(character);
    setFormData({
      discord_user_id: character.discord_user_id,
      discord_username: character.discord_username || '',
      name: character.name,
      age: character.age,
      background: character.background || '',
      faction: character.faction || '',
      occupation: character.occupation || '',
      appearance: character.appearance || '',
      status: character.status,
    });
    setIsCreateOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.discord_user_id) {
      toast({
        title: 'Fejl',
        description: 'Navn og Discord bruger-ID er påkrævet',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingCharacter) {
        await updateCharacter.mutateAsync({
          id: editingCharacter.id,
          name: formData.name,
          age: formData.age,
          background: formData.background || null,
          faction: formData.faction || null,
          occupation: formData.occupation || null,
          appearance: formData.appearance || null,
          status: formData.status,
          discord_username: formData.discord_username || null,
        });
        toast({ title: 'Karakter opdateret', description: `${formData.name} er blevet opdateret` });
      } else {
        await createCharacter.mutateAsync({
          guild_id: selectedGuild!.id,
          discord_user_id: formData.discord_user_id,
          discord_username: formData.discord_username || null,
          name: formData.name,
          age: formData.age,
          background: formData.background || null,
          faction: formData.faction || null,
          occupation: formData.occupation || null,
          appearance: formData.appearance || null,
          status: formData.status,
          avatar_url: null,
          is_active: true,
        });
        toast({ title: 'Karakter oprettet', description: `${formData.name} er blevet tilføjet` });
      }
      
      setIsCreateOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: 'Fejl',
        description: 'Kunne ikke gemme karakter',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (character: Character) => {
    try {
      await deleteCharacter.mutateAsync(character.id);
      toast({ title: 'Karakter slettet', description: `${character.name} er blevet slettet` });
    } catch (error) {
      toast({
        title: 'Fejl',
        description: 'Kunne ikke slette karakter',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Karakterer</h1>
            <p className="text-muted-foreground">Administrer alle RP-karakterer på serveren</p>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Opret karakter
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                Total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats?.total || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                I Live
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{stats?.alive || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Skull className="h-4 w-4" />
                Døde
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{stats?.dead || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <UserX className="h-4 w-4" />
                Pensioneret
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-muted-foreground">{stats?.retired || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <User className="h-4 w-4" />
                Spillere
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats?.uniquePlayers || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Character List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle>Karakterliste</CardTitle>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg karakterer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Button
                variant={statusFilter === undefined ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(undefined)}
              >
                Alle
              </Button>
              <Button
                variant={statusFilter === 'alive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('alive')}
              >
                I Live
              </Button>
              <Button
                variant={statusFilter === 'dead' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('dead')}
              >
                Døde
              </Button>
              <Button
                variant={statusFilter === 'retired' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('retired')}
              >
                Pensioneret
              </Button>
            </div>

            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <p className="text-muted-foreground">Indlæser...</p>
              ) : filteredCharacters && filteredCharacters.length > 0 ? (
                <div className="space-y-3">
                  {filteredCharacters.map((character) => (
                    <Card key={character.id} className="bg-muted/30">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={character.avatar_url || undefined} />
                            <AvatarFallback>
                              <User className="h-6 w-6" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold truncate">{character.name}</h3>
                                <StatusBadge status={character.status} />
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(character)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Slet karakter?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Er du sikker på at du vil slette <strong>{character.name}</strong>? Denne handling kan ikke fortrydes.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuller</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDelete(character)}
                                        className="bg-destructive hover:bg-destructive/90"
                                      >
                                        Slet
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Spillet af: {character.discord_username || character.discord_user_id}
                            </p>
                            {(character.age || character.faction || character.occupation) && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {character.age && <Badge variant="outline">{character.age} år</Badge>}
                                {character.faction && <Badge variant="outline">{character.faction}</Badge>}
                                {character.occupation && <Badge variant="outline">{character.occupation}</Badge>}
                              </div>
                            )}
                            {character.background && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {character.background}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              Oprettet {formatDistanceToNow(new Date(character.created_at), { addSuffix: true, locale: da })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Ingen karakterer fundet</p>
                  <Button variant="outline" className="mt-4" onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Opret den første karakter
                  </Button>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCharacter ? 'Rediger karakter' : 'Opret ny karakter'}</DialogTitle>
            <DialogDescription>
              {editingCharacter ? 'Opdater karakterens oplysninger' : 'Tilføj en ny karakter til databasen'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discord_user_id">Discord bruger-ID *</Label>
                <Input
                  id="discord_user_id"
                  value={formData.discord_user_id}
                  onChange={(e) => setFormData({ ...formData, discord_user_id: e.target.value })}
                  placeholder="123456789012345678"
                  disabled={!!editingCharacter}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discord_username">Discord brugernavn</Label>
                <Input
                  id="discord_username"
                  value={formData.discord_username}
                  onChange={(e) => setFormData({ ...formData, discord_username: e.target.value })}
                  placeholder="brugernavn"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Karakternavn *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Alder</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age || ''}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="25"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="faction">Fraktion</Label>
                <Input
                  id="faction"
                  value={formData.faction}
                  onChange={(e) => setFormData({ ...formData, faction: e.target.value })}
                  placeholder="Politi, Bande, osv."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="occupation">Stilling/Job</Label>
                <Input
                  id="occupation"
                  value={formData.occupation}
                  onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                  placeholder="Mekaniker, Læge, osv."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as CharacterStatus })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alive">I live</SelectItem>
                  <SelectItem value="dead">Død</SelectItem>
                  <SelectItem value="retired">Pensioneret</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="background">Baggrundshistorie</Label>
              <Textarea
                id="background"
                value={formData.background}
                onChange={(e) => setFormData({ ...formData, background: e.target.value })}
                placeholder="Beskriv karakterens baggrundshistorie..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appearance">Udseende</Label>
              <Textarea
                id="appearance"
                value={formData.appearance}
                onChange={(e) => setFormData({ ...formData, appearance: e.target.value })}
                placeholder="Beskriv karakterens udseende..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
              Annuller
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createCharacter.isPending || updateCharacter.isPending}
            >
              {createCharacter.isPending || updateCharacter.isPending 
                ? 'Gemmer...' 
                : editingCharacter ? 'Opdater' : 'Opret'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
