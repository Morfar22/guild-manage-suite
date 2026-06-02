import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAllGuilds } from '@/hooks/useAdmin';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Rocket, Loader2, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';

export function GuildCommandDeployer() {
  const { toast } = useToast();
  const { data: guilds } = useAllGuilds();
  const [guildId, setGuildId] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [lastResult, setLastResult] = useState<{ count: number; commands: string[] } | null>(null);

  const handleDeploy = async () => {
    const trimmed = guildId.trim();
    if (!/^\d{17,20}$/.test(trimmed)) {
      toast({ title: 'Ugyldigt Guild ID', description: 'Indtast et gyldigt Discord Guild ID (17-20 cifre).', variant: 'destructive' });
      return;
    }

    setDeploying(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('deploy-guild-commands', {
        body: { discordGuildId: trimmed, mode: 'deploy' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLastResult({ count: data.deployed, commands: data.commands || [] });
      toast({ title: '✅ Kommandoer deployed', description: `${data.deployed} slash-kommandoer registreret øjeblikkeligt på guild ${trimmed}.` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ukendt fejl';
      toast({ title: 'Fejl ved deployment', description: msg, variant: 'destructive' });
    } finally {
      setDeploying(false);
    }
  };

  const handleClearGlobal = async () => {
    setClearing(true);
    try {
      const { data, error } = await supabase.functions.invoke('deploy-guild-commands', {
        body: { mode: 'clear-global' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: '✅ Globale kommandoer ryddet',
        description: 'Discord-cachen kan tage op til 1 time at opdatere. Brug deploy-knappen pr. guild for øjeblikkelig adgang.',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ukendt fejl';
      toast({ title: 'Fejl', description: msg, variant: 'destructive' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Deploy Slash-Kommandoer pr. Guild
        </CardTitle>
        <CardDescription>
          Registrér alle bot-kommandoer øjeblikkeligt på en specifik Discord-server. Bruger den globale kommandoliste fra Discord som kilde.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Vælg fra registrerede servere (valgfrit)</Label>
          <Select
            value=""
            onValueChange={(val) => {
              const g = guilds?.find((x) => x.id === val);
              if (g?.guild_id) setGuildId(g.guild_id);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Vælg en server fra listen..." />
            </SelectTrigger>
            <SelectContent>
              {guilds?.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.guild_name} <span className="text-muted-foreground">({g.guild_id})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="guild-id-input">Discord Guild ID</Label>
          <Input id="guild-id-input" placeholder="f.eks. 1491785137891971133" value={guildId} onChange={(e) => setGuildId(e.target.value)} className="font-mono" />
        </div>

        <Button onClick={handleDeploy} disabled={deploying || !guildId.trim()} className="w-full">
          {deploying ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deployer...</>) : (<><Rocket className="mr-2 h-4 w-4" />Deploy kommandoer til guild</>)}
        </Button>

        {lastResult && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {lastResult.count} kommandoer deployed
            </div>
            <div className="flex flex-wrap gap-1">
              {lastResult.commands.map((c) => (
                <Badge key={c} variant="secondary" className="text-xs font-mono">/{c}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-4 space-y-2">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="space-y-1 flex-1">
              <p className="text-sm font-medium text-destructive">Ser du dobbelte kommandoer i Discord?</p>
              <p className="text-xs text-muted-foreground">
                Det sker hvis kommandoer er registreret BÅDE globalt og pr. guild. Ryd globale kommandoer her — derefter eksisterer kun guild-versionerne (deployed med knappen ovenover).
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={clearing} className="w-full">
                {clearing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rydder...</>) : (<><Trash2 className="mr-2 h-4 w-4" />Ryd globale kommandoer (fjerner duplikater)</>)}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ryd alle globale slash-kommandoer?</AlertDialogTitle>
                <AlertDialogDescription>
                  Dette fjerner alle bot-kommandoer fra Discords globale registrering. Servere der bruger guild-deployment (knappen ovenover) påvirkes ikke. Servere der KUN bruger globale kommandoer mister adgang indtil du re-deployer dem pr. guild.
                  <br /><br />
                  Discord-cachen kan tage op til 1 time at opdatere efter ryddeoperationen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annullér</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearGlobal}>Ja, ryd globale</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
