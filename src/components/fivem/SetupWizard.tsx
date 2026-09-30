import { useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, KeyRound, Link2, RefreshCw, Server, ShieldCheck, Unplug, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFiveMBridgeStatus, useRevokeFiveMBridgeKey, useRotateFiveMBridgeKey } from '@/hooks/useFiveM';

const RESOURCE_URL = 'https://github.com/Morfar22/guild-manage-suite/tree/main/fivem/guild_manage_bridge';

export default function SetupWizard() {
  const { toast } = useToast();
  const { data: status, isLoading, refetch } = useFiveMBridgeStatus();
  const rotateKey = useRotateFiveMBridgeKey();
  const revokeKey = useRevokeFiveMBridgeKey();
  const [visibleKey, setVisibleKey] = useState<string | null>(null);

  const connected = useMemo(() => {
    if (!status?.lastSeenAt) return false;
    return Date.now() - new Date(status.lastSeenAt).getTime() < 90_000;
  }, [status?.lastSeenAt]);

  const apiBase = status?.apiBase || 'https://bot.nethost-solutions.dk';
  const guildId = status?.discordGuildId || 'DIT_DISCORD_GUILD_ID';
  const key = visibleKey || 'GENERER_EN_NY_NØGLE';

  const cfg = [
    '# Guild Manage Suite - FiveM Bridge',
    `setr gms_api_base "${apiBase}"`,
    `setr gms_guild_id "${guildId}"`,
    `setr gms_api_key "${key}"`,
    'setr gms_server_id "main"',
    'setr gms_framework "auto"',
    '',
    'ensure guild_manage_bridge',
  ].join('\n');

  const copy = async (value: string, title = 'Kopieret') => {
    await navigator.clipboard.writeText(value);
    toast({ title });
  };

  const handleRotate = async () => {
    try {
      const result = await rotateKey.mutateAsync();
      setVisibleKey(result.token);
      toast({
        title: status?.configured ? 'Ny bridge-nøgle oprettet' : 'Bridge-nøgle oprettet',
        description: 'Kopiér server.cfg-blokken nu. Nøglen vises kun i denne session.',
      });
    } catch (error) {
      toast({
        title: 'Kunne ikke oprette bridge-nøgle',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleRevoke = async () => {
    try {
      await revokeKey.mutateAsync();
      setVisibleKey(null);
      toast({ title: 'Bridge-nøglen er tilbagekaldt' });
    } catch (error) {
      toast({
        title: 'Kunne ikke tilbagekalde nøglen',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className={connected ? 'border-green-500/40' : 'border-border'}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                {connected ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Unplug className="h-5 w-5 text-muted-foreground" />}
                FiveM Bridge
              </CardTitle>
              <CardDescription>
                Én resource forbinder dashboard, Discord commands, whitelist, bans, spillerliste og serverstatus.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={connected ? 'default' : 'secondary'}>
                {isLoading ? 'Tjekker…' : connected ? 'Forbundet' : status?.configured ? 'Nøgle oprettet, afventer server' : 'Ikke sat op'}
              </Badge>
              <Button variant="outline" size="icon" onClick={() => refetch()} title="Opdater status">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Discord Server ID</div>
            <div className="mt-1 font-mono text-sm break-all">{guildId}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Framework</div>
            <div className="mt-1 font-medium">{status?.framework || 'Afventer bridge'}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Bridge version</div>
            <div className="mt-1 font-medium">{status?.bridgeVersion || 'Afventer bridge'}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Sidst set</div>
            <div className="mt-1 font-medium">
              {status?.lastSeenAt ? new Date(status.lastSeenAt).toLocaleString('da-DK') : 'Aldrig'}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="h-5 w-5" />
              1. Installér resource
            </CardTitle>
            <CardDescription>Placér mappen i din FiveM resources-mappe.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted p-3 font-mono text-sm">
              resources/[local]/guild_manage_bridge
            </div>
            <Button variant="outline" className="w-full" asChild>
              <a href={RESOURCE_URL} target="_blank" rel="noreferrer">
                Åbn resource <Link2 className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Ingen framework dependency. QBox, QBCore og ESX registreres automatisk.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5" />
              2. Opret sikker nøgle
            </CardTitle>
            <CardDescription>Nøglen gælder kun denne Discord/FiveM integration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={handleRotate} disabled={rotateKey.isPending}>
              {rotateKey.isPending ? 'Opretter…' : status?.configured ? 'Rotér bridge-nøgle' : 'Generér bridge-nøgle'}
            </Button>
            {visibleKey && (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="text-xs font-medium">Vises kun nu</div>
                <div className="break-all font-mono text-xs">{visibleKey}</div>
                <Button size="sm" variant="outline" onClick={() => copy(visibleKey, 'Nøglen er kopieret')}>
                  <Clipboard className="mr-2 h-4 w-4" /> Kopiér nøgle
                </Button>
              </div>
            )}
            {status?.configured && (
              <Button variant="ghost" className="w-full text-destructive" onClick={handleRevoke} disabled={revokeKey.isPending}>
                Tilbagekald nøgle
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5" />
              3. server.cfg
            </CardTitle>
            <CardDescription>Kopiér blokken, gem og genstart resourcen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="max-h-56 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap break-all">{cfg}</pre>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => copy(cfg, visibleKey ? 'server.cfg-blokken er kopieret' : 'Generér først en nøgle')}
              disabled={!visibleKey && !status?.configured}
            >
              <Clipboard className="mr-2 h-4 w-4" />
              Kopiér server.cfg
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5" />
            Hvad bliver sat op automatisk?
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
          {[
            'Server heartbeat og live status',
            'Online spillere og identifiers',
            'Whitelist og bans ved join',
            'Spilletid og sessions',
            'Discord /fivem permissions',
            'Dashboard command queue',
            'QBox/QBCore/ESX autodetect',
            'Command-resultater tilbage til Discord',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg border p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
