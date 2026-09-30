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
  const cfg = visibleKey
    ? [
        '# Guild Manage Suite - FiveM Bridge',
        `setr gms_api_base "${apiBase}"`,
        `setr gms_guild_id "${guildId}"`,
        `setr gms_api_key "${visibleKey}"`,
        'setr gms_server_id "main"',
        'setr gms_framework "auto"',
        '',
        'ensure guild_manage_bridge',
      ].join('\n')
    : [
        '# Generér eller rotér bridge-nøglen først.',
        '# Af sikkerhedsgrunde kan en eksisterende nøgle ikke læses igen.',
        `# Discord Server ID: ${guildId}`,
        `# API: ${apiBase}`,
      ].join('\n');

  const advancedCfg = [
    '# Valgfrit - standarderne passer til de fleste servere',
    'setr gms_command_poll_ms "1500"',
    'setr gms_player_sync_ms "15000"',
    'setr gms_heartbeat_ms "30000"',
    'setr gms_settings_refresh_ms "60000"',
    'setr gms_client_action_timeout_ms "8000"',
    'setr gms_api_timeout_ms "10000"',
    'setr gms_fail_open "false"',
    'setr gms_debug "false"',
    '',
    '# Valgfri adapters til server-specifikke scripts',
    '# setr gms_event_revive "dit_ems:client:revive"',
    '# setr gms_event_jail "dit_jail:client:jail"',
    '# setr gms_event_unjail "dit_jail:client:unjail"',
    '# setr gms_event_clothing "dit_clothing:client:open"',
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

      {status && status.schemaReady === false && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Database-opdatering mangler</CardTitle>
            <CardDescription>
              FiveM bridge-kolonnerne findes ikke i den aktive Supabase-database endnu. Kør de nyeste migrations, og opdater derefter siden.
            </CardDescription>
          </CardHeader>
          {status.schemaError && (
            <CardContent>
              <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{status.schemaError}</pre>
            </CardContent>
          )}
        </Card>
      )}

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
            <Button className="w-full" onClick={handleRotate} disabled={rotateKey.isPending || status?.schemaReady === false}>
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
            {status?.configured && !visibleKey && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-muted-foreground">
                Der findes allerede en nøgle, men den kan ikke vises igen. Hvis du skal installere på ny eller flytte serveren, så rotér nøglen og kopiér den nye blok med det samme.
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
              onClick={() => copy(cfg, 'server.cfg-blokken er kopieret')}
              disabled={!visibleKey}
            >
              <Clipboard className="mr-2 h-4 w-4" />
              Kopiér server.cfg
            </Button>
            {!visibleKey && (
              <p className="text-xs text-muted-foreground">
                Generér/rotér først nøglen. Vi tillader ikke kopiering af en config med en falsk placeholder-nøgle.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5" />
            4. Test forbindelsen
          </CardTitle>
          <CardDescription>
            Efter installation skal bridgen kunne bestå sin egen diagnosticering.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Kør i FXServer/txAdmin console</div>
            <pre className="rounded-lg bg-muted p-3 text-xs">restart guild_manage_bridge{String.raw`\n`}gmsbridge</pre>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy('restart guild_manage_bridge\ngmsbridge', 'Testkommandoer kopieret')}
            >
              <Clipboard className="mr-2 h-4 w-4" /> Kopiér testkommandoer
            </Button>
            <p className="text-xs text-muted-foreground">
              <strong>gmsbridge</strong> viser framework, guild/server ID, API-status og om bridge-nøglen virker.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Valgfri avanceret config</div>
            <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{advancedCfg}</pre>
            <Button size="sm" variant="outline" onClick={() => copy(advancedCfg, 'Avanceret config kopieret')}>
              <Clipboard className="mr-2 h-4 w-4" /> Kopiér avanceret config
            </Button>
          </div>
        </CardContent>
      </Card>

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
            'Command-resultater bekræftes af FiveM-klienten',
            'Sikker retry/timeout ved client actions',
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
