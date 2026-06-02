import { useEffect, useState } from 'react';
import {
  Terminal,
  Play,
  Users,
  Ban,
  Zap,
  Heart,
  MessageSquare,
  MapPin,
  Cloud,
  Clock,
  Car,
  Briefcase,
  Shield,
  Package,
  DollarSign,
  Megaphone,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useExecuteFiveMCommand, useFiveMOnlinePlayers, useRegisterFiveMCommands } from '@/hooks/useFiveM';
import { useFiveMCommandQueueEntry } from '@/hooks/fivem/useFiveMCommandQueueEntry';

interface CommandDef {
  name: string;
  description: string;
  permission: string;
  icon: React.ReactNode;
  fields: { name: string; label: string; type: string; required?: boolean; options?: { value: string; label: string }[] }[];
}

const STANDALONE_COMMANDS: CommandDef[] = [
  {
    name: 'announcement',
    description: 'Send announcement til alle spillere',
    permission: 'mod',
    icon: <Megaphone className="h-4 w-4" />,
    fields: [{ name: 'message', label: 'Besked', type: 'textarea', required: true }],
  },
  {
    name: 'embed',
    description: 'Send custom embed til spillere',
    permission: 'mod',
    icon: <MessageSquare className="h-4 w-4" />,
    fields: [
      { name: 'title', label: 'Titel', type: 'text', required: true },
      { name: 'message', label: 'Besked', type: 'textarea', required: true },
      { name: 'color', label: 'Farve (hex)', type: 'text' },
    ],
  },
  {
    name: 'identifiers',
    description: 'Vis spillerens identifiers',
    permission: 'mod',
    icon: <Shield className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'kick',
    description: 'Kick en spiller fra serveren',
    permission: 'mod',
    icon: <Users className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'reason', label: 'Årsag', type: 'text' },
    ],
  },
  {
    name: 'kickall',
    description: 'Kick alle spillere',
    permission: 'admin',
    icon: <Users className="h-4 w-4" />,
    fields: [{ name: 'reason', label: 'Årsag', type: 'text', required: true }],
  },
  {
    name: 'kill',
    description: 'Dræb en spiller',
    permission: 'admin',
    icon: <Zap className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'message',
    description: 'Send privat besked til en spiller',
    permission: 'mod',
    icon: <MessageSquare className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'message', label: 'Besked', type: 'textarea', required: true },
    ],
  },
  {
    name: 'onlinecount',
    description: 'Vis antal online spillere',
    permission: 'user',
    icon: <Users className="h-4 w-4" />,
    fields: [],
  },
  {
    name: 'players',
    description: 'Vis liste over online spillere',
    permission: 'mod',
    icon: <Users className="h-4 w-4" />,
    fields: [],
  },
  {
    name: 'resource',
    description: 'Administrer server ressourcer',
    permission: 'god',
    icon: <RefreshCw className="h-4 w-4" />,
    fields: [
      { name: 'action', label: 'Handling', type: 'select', required: true, options: [
        { value: 'start', label: 'Start' },
        { value: 'stop', label: 'Stop' },
        { value: 'restart', label: 'Restart' },
        { value: 'refresh', label: 'Refresh' },
      ]},
      { name: 'resourceName', label: 'Resource navn', type: 'text', required: true },
    ],
  },
  {
    name: 'server',
    description: 'Server info og status',
    permission: 'mod',
    icon: <Terminal className="h-4 w-4" />,
    fields: [],
  },
  {
    name: 'screenshot',
    description: 'Tag screenshot af spillers skærm',
    permission: 'admin',
    icon: <Terminal className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'teleport',
    description: 'Teleporter en spiller',
    permission: 'mod',
    icon: <MapPin className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'x', label: 'X Koordinat', type: 'number' },
      { name: 'y', label: 'Y Koordinat', type: 'number' },
      { name: 'z', label: 'Z Koordinat', type: 'number' },
      { name: 'location', label: 'Eller vælg preset', type: 'select', options: [
        { value: 'pillbox', label: 'Pillbox Hospital' },
        { value: 'mrpd', label: 'Mission Row PD' },
        { value: 'airport', label: 'LS Airport' },
        { value: 'legion', label: 'Legion Square' },
        { value: 'paleto', label: 'Paleto Bay' },
        { value: 'sandy', label: 'Sandy Shores' },
      ]},
    ],
  },
  {
    name: 'teleport-all',
    description: 'Teleporter alle til en lokation',
    permission: 'god',
    icon: <MapPin className="h-4 w-4" />,
    fields: [
      { name: 'location', label: 'Lokation', type: 'select', required: true, options: [
        { value: 'pillbox', label: 'Pillbox Hospital' },
        { value: 'mrpd', label: 'Mission Row PD' },
        { value: 'airport', label: 'LS Airport' },
        { value: 'legion', label: 'Legion Square' },
      ]},
    ],
  },
  {
    name: 'whitelist',
    description: 'Administrer whitelist',
    permission: 'admin',
    icon: <Shield className="h-4 w-4" />,
    fields: [
      { name: 'action', label: 'Handling', type: 'select', required: true, options: [
        { value: 'add', label: 'Tilføj' },
        { value: 'remove', label: 'Fjern' },
        { value: 'check', label: 'Tjek' },
      ]},
      { name: 'discordId', label: 'Discord ID', type: 'text', required: true },
    ],
  },
  {
    name: 'give-weapon',
    description: 'Giv våben til spiller',
    permission: 'god',
    icon: <Zap className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'weapon', label: 'Våben kode', type: 'text', required: true },
      { name: 'ammo', label: 'Ammunition', type: 'number' },
    ],
  },
  {
    name: 'remove-weapon',
    description: 'Fjern våben fra spiller',
    permission: 'admin',
    icon: <Zap className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'weapon', label: 'Våben kode', type: 'text', required: true },
    ],
  },
  {
    name: 'clear-weapons',
    description: 'Fjern alle våben fra spiller',
    permission: 'admin',
    icon: <Zap className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'freeze',
    description: 'Frys en spiller',
    permission: 'mod',
    icon: <Shield className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'unfreeze',
    description: 'Frigør en spiller',
    permission: 'mod',
    icon: <Shield className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'noclip',
    description: 'Toggle noclip for spiller',
    permission: 'admin',
    icon: <MapPin className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'godmode',
    description: 'Toggle godmode for spiller',
    permission: 'god',
    icon: <Shield className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'invisible',
    description: 'Toggle usynlighed for spiller',
    permission: 'admin',
    icon: <Shield className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'spectate',
    description: 'Spectate en spiller',
    permission: 'mod',
    icon: <Users className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'bring',
    description: 'Bring en spiller til dig',
    permission: 'mod',
    icon: <MapPin className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'goto',
    description: 'Gå til en spiller',
    permission: 'mod',
    icon: <MapPin className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'warn',
    description: 'Advar en spiller',
    permission: 'mod',
    icon: <MessageSquare className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'reason', label: 'Årsag', type: 'textarea', required: true },
    ],
  },
];

const QBCORE_COMMANDS: CommandDef[] = [
  {
    name: 'ban',
    description: 'Ban en spiller',
    permission: 'admin',
    icon: <Ban className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'duration', label: 'Varighed', type: 'select', required: true, options: [
        { value: '1h', label: '1 time' },
        { value: '1d', label: '1 dag' },
        { value: '7d', label: '7 dage' },
        { value: '30d', label: '30 dage' },
        { value: 'permanent', label: 'Permanent' },
      ]},
      { name: 'reason', label: 'Årsag', type: 'textarea', required: true },
    ],
  },
  {
    name: 'revive',
    description: 'Genopliv en spiller',
    permission: 'admin',
    icon: <Heart className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'revive-all',
    description: 'Genopliv alle spillere',
    permission: 'god',
    icon: <Heart className="h-4 w-4" />,
    fields: [],
  },
  {
    name: 'money',
    description: 'Administrer spillers penge',
    permission: 'admin',
    icon: <DollarSign className="h-4 w-4" />,
    fields: [
      { name: 'action', label: 'Handling', type: 'select', required: true, options: [
        { value: 'add', label: 'Tilføj' },
        { value: 'remove', label: 'Fjern' },
        { value: 'set', label: 'Sæt' },
      ]},
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'type', label: 'Type', type: 'select', required: true, options: [
        { value: 'cash', label: 'Cash' },
        { value: 'bank', label: 'Bank' },
        { value: 'crypto', label: 'Crypto' },
      ]},
      { name: 'amount', label: 'Beløb', type: 'number', required: true },
    ],
  },
  {
    name: 'inventory',
    description: 'Administrer spillers inventory',
    permission: 'admin',
    icon: <Package className="h-4 w-4" />,
    fields: [
      { name: 'action', label: 'Handling', type: 'select', required: true, options: [
        { value: 'give', label: 'Giv' },
        { value: 'take', label: 'Tag' },
        { value: 'inspect', label: 'Inspicér' },
        { value: 'clear', label: 'Ryd' },
      ]},
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'item', label: 'Item navn', type: 'text' },
      { name: 'count', label: 'Antal', type: 'number' },
    ],
  },
  {
    name: 'job',
    description: 'Administrer spillers job',
    permission: 'admin',
    icon: <Briefcase className="h-4 w-4" />,
    fields: [
      { name: 'action', label: 'Handling', type: 'select', required: true, options: [
        { value: 'set', label: 'Sæt' },
        { value: 'fire', label: 'Fyr' },
        { value: 'inspect', label: 'Inspicér' },
      ]},
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'job', label: 'Job navn', type: 'text' },
      { name: 'grade', label: 'Grade', type: 'number' },
    ],
  },
  {
    name: 'gang',
    description: 'Administrer spillers gang',
    permission: 'admin',
    icon: <Users className="h-4 w-4" />,
    fields: [
      { name: 'action', label: 'Handling', type: 'select', required: true, options: [
        { value: 'set', label: 'Sæt' },
        { value: 'remove', label: 'Fjern' },
        { value: 'inspect', label: 'Inspicér' },
      ]},
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'gang', label: 'Gang navn', type: 'text' },
      { name: 'grade', label: 'Grade', type: 'number' },
    ],
  },
  {
    name: 'weather',
    description: 'Sæt server vejr',
    permission: 'admin',
    icon: <Cloud className="h-4 w-4" />,
    fields: [
      { name: 'weather', label: 'Vejr', type: 'select', required: true, options: [
        { value: 'CLEAR', label: 'Klart' },
        { value: 'CLOUDS', label: 'Skyet' },
        { value: 'OVERCAST', label: 'Overskyet' },
        { value: 'RAIN', label: 'Regn' },
        { value: 'THUNDER', label: 'Torden' },
        { value: 'SNOW', label: 'Sne' },
        { value: 'FOGGY', label: 'Tåge' },
        { value: 'BLIZZARD', label: 'Snestorm' },
        { value: 'XMAS', label: 'Jul' },
      ]},
    ],
  },
  {
    name: 'time',
    description: 'Sæt server tid',
    permission: 'admin',
    icon: <Clock className="h-4 w-4" />,
    fields: [{ name: 'hour', label: 'Time (0-23)', type: 'number', required: true }],
  },
  {
    name: 'vehicle',
    description: 'Spawn køretøj til spiller',
    permission: 'god',
    icon: <Car className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'vehicleCode', label: 'Køretøj kode', type: 'text', required: true },
      { name: 'plate', label: 'Nummerplade', type: 'text' },
    ],
  },
  {
    name: 'delvehicle',
    description: 'Slet køretøj',
    permission: 'admin',
    icon: <Car className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player' }],
  },
  {
    name: 'repair',
    description: 'Reparer køretøj',
    permission: 'mod',
    icon: <Car className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player' }],
  },
  {
    name: 'clothing-menu',
    description: 'Åbn tøjmenu for spiller',
    permission: 'admin',
    icon: <Users className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'jail',
    description: 'Fængsl en spiller',
    permission: 'mod',
    icon: <Shield className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'time', label: 'Tid (minutter)', type: 'number', required: true },
      { name: 'reason', label: 'Årsag', type: 'text' },
    ],
  },
  {
    name: 'unjail',
    description: 'Løslad en spiller',
    permission: 'mod',
    icon: <Shield className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'permissions',
    description: 'Vis spillers permissions',
    permission: 'admin',
    icon: <Shield className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'logout',
    description: 'Log en spiller ud',
    permission: 'admin',
    icon: <Users className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'setmodel',
    description: 'Skift spillers ped model',
    permission: 'admin',
    icon: <Users className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'model', label: 'Model navn', type: 'text', required: true },
    ],
  },
  {
    name: 'setarmor',
    description: 'Sæt spillers armor',
    permission: 'admin',
    icon: <Shield className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'amount', label: 'Armor (0-100)', type: 'number', required: true },
    ],
  },
  {
    name: 'sethealth',
    description: 'Sæt spillers health',
    permission: 'admin',
    icon: <Heart className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'amount', label: 'Health (0-200)', type: 'number', required: true },
    ],
  },
  {
    name: 'setstress',
    description: 'Sæt spillers stress niveau',
    permission: 'admin',
    icon: <Heart className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'amount', label: 'Stress (0-100)', type: 'number', required: true },
    ],
  },
  {
    name: 'sethunger',
    description: 'Sæt spillers sult',
    permission: 'admin',
    icon: <Heart className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'amount', label: 'Sult (0-100)', type: 'number', required: true },
    ],
  },
  {
    name: 'setthirst',
    description: 'Sæt spillers tørst',
    permission: 'admin',
    icon: <Heart className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'amount', label: 'Tørst (0-100)', type: 'number', required: true },
    ],
  },
  {
    name: 'warn',
    description: 'Advar en spiller',
    permission: 'mod',
    icon: <MessageSquare className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'reason', label: 'Årsag', type: 'textarea', required: true },
    ],
  },
  {
    name: 'delwarn',
    description: 'Fjern advarsel',
    permission: 'admin',
    icon: <MessageSquare className="h-4 w-4" />,
    fields: [
      { name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true },
      { name: 'warningId', label: 'Warning ID', type: 'number', required: true },
    ],
  },
  {
    name: 'charinfo',
    description: 'Vis karakter info',
    permission: 'mod',
    icon: <Users className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'heal',
    description: 'Heal en spiller til fuld health',
    permission: 'admin',
    icon: <Heart className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
  {
    name: 'armor',
    description: 'Giv spiller fuld armor',
    permission: 'admin',
    icon: <Shield className="h-4 w-4" />,
    fields: [{ name: 'targetPlayerId', label: 'Spiller ID', type: 'player', required: true }],
  },
];

export default function CommandPanel() {
  const { toast } = useToast();
  const { data: onlinePlayers } = useFiveMOnlinePlayers();
  const executeCommand = useExecuteFiveMCommand();
  const registerCommands = useRegisterFiveMCommands();

  const [pendingCommandId, setPendingCommandId] = useState<string | null>(null);
  const pending = useFiveMCommandQueueEntry(pendingCommandId);

  const [selectedCommand, setSelectedCommand] = useState<CommandDef | null>(null);
  const [commandValues, setCommandValues] = useState<Record<string, string | number>>({});

  // Track command execution status with polling
  useEffect(() => {
    if (!pendingCommandId) {
      return;
    }
    
    const status = pending.data?.status;
    const result = pending.data?.result;
    
    console.log("[CommandPanel] Polling:", { pendingCommandId, status, result });
    
    // Still loading or no data yet
    if (pending.isLoading || !pending.data) {
      return;
    }

    // Command finished - show result
    if (status === 'executed') {
      toast({
        title: '✅ Kommando udført',
        description: result || 'Success',
      });
      setPendingCommandId(null);
      return;
    }

    if (status === 'failed') {
      toast({
        title: '❌ Kommando fejlede',
        description: result || 'Se FiveM server log for detaljer.',
        variant: 'destructive',
      });
      setPendingCommandId(null);
      return;
    }
    
    // status === 'pending' - keep polling (handled by refetchInterval)
  }, [pending.data, pending.isLoading, pendingCommandId, toast]);

  const handleOpenCommand = (cmd: CommandDef) => {
    setSelectedCommand(cmd);
    setCommandValues({});
  };

  const handleExecute = async () => {
    if (!selectedCommand) return;

    // Validate required fields
    for (const field of selectedCommand.fields) {
      if (field.required && !commandValues[field.name]) {
        toast({ title: `${field.label} er påkrævet`, variant: 'destructive' });
        return;
      }
    }

    // Get target player info if needed
    let targetDiscordId: string | undefined;
    let targetName: string | undefined;
    if (commandValues.targetPlayerId) {
      const player = onlinePlayers?.find(p => p.player_id === Number(commandValues.targetPlayerId));
      if (player) {
        targetDiscordId = player.discord_user_id || undefined;
        targetName = player.discord_username || player.character_name || undefined;
      }
    }

    try {
      const result = await executeCommand.mutateAsync({
        name: selectedCommand.name,
        targetPlayerId: commandValues.targetPlayerId as number,
        targetDiscordId,
        targetName,
        action: commandValues.action as string,
        reason: commandValues.reason as string,
        duration: commandValues.duration as string,
        message: commandValues.message as string,
        amount: commandValues.amount as number,
        type: commandValues.type as string,
        item: commandValues.item as string,
        count: commandValues.count as number,
        weather: commandValues.weather as string,
        hour: commandValues.hour as number,
        vehicleCode: commandValues.vehicleCode as string,
        plate: commandValues.plate as string,
        job: commandValues.job as string,
        gang: commandValues.gang as string,
        grade: commandValues.grade as number,
        location: commandValues.location as string,
        resourceName: commandValues.resourceName as string,
        discordId: commandValues.discordId as string,
        weapon: commandValues.weapon as string,
        ammo: commandValues.ammo as number,
        model: commandValues.model as string,
        time: commandValues.time as number,
        coords: commandValues.x ? {
          x: Number(commandValues.x),
          y: Number(commandValues.y),
          z: Number(commandValues.z),
        } : undefined,
      });

      if (result?.success === false) {
        toast({ title: result.error || 'Kommando fejlede', variant: 'destructive' });
        return;
      }

      // The command is queued; we poll the queue row to show executed/failed + result.
      if (result?.commandId) {
        setPendingCommandId(String(result.commandId));
        toast({ title: `⏳ ${selectedCommand.name} sat i kø...` });
      } else {
        // Fallback if backend didn't return id
        toast({ title: `⏳ ${selectedCommand.name} sat i kø...` });
      }

      setSelectedCommand(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Ukendt fejl';
      toast({ title: `Fejl: ${errorMsg}`, variant: 'destructive' });
    }
  };

  const handleRegisterCommands = async () => {
    try {
      await registerCommands.mutateAsync('register');
      toast({ title: '✅ 55+ FiveM slash commands registreret i Discord!' });
    } catch {
      toast({ title: 'Fejl ved registrering', variant: 'destructive' });
    }
  };

  const getPermissionBadge = (permission: string) => {
    switch (permission) {
      case 'god': return <Badge variant="destructive">GOD</Badge>;
      case 'admin': return <Badge>Admin</Badge>;
      case 'mod': return <Badge variant="secondary">Mod</Badge>;
      default: return <Badge variant="outline">User</Badge>;
    }
  };

  const renderField = (field: CommandDef['fields'][0]) => {
    if (field.type === 'player') {
      return (
        <Select
          value={String(commandValues[field.name] || '')}
          onValueChange={(v) => setCommandValues({ ...commandValues, [field.name]: Number(v) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Vælg spiller..." />
          </SelectTrigger>
          <SelectContent>
            {onlinePlayers?.length === 0 ? (
              <SelectItem value="none" disabled>Ingen spillere online</SelectItem>
            ) : (
              onlinePlayers?.map((player) => (
                <SelectItem key={player.player_id} value={String(player.player_id)}>
                  #{player.player_id} - {player.discord_username || player.character_name || 'Ukendt'}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <Select
          value={String(commandValues[field.name] || '')}
          onValueChange={(v) => setCommandValues({ ...commandValues, [field.name]: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Vælg..." />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === 'textarea') {
      return (
        <Textarea
          value={String(commandValues[field.name] || '')}
          onChange={(e) => setCommandValues({ ...commandValues, [field.name]: e.target.value })}
          placeholder={field.label}
        />
      );
    }

    if (field.type === 'number') {
      return (
        <Input
          type="number"
          value={String(commandValues[field.name] || '')}
          onChange={(e) => setCommandValues({ ...commandValues, [field.name]: Number(e.target.value) })}
          placeholder={field.label}
        />
      );
    }

    return (
      <Input
        value={String(commandValues[field.name] || '')}
        onChange={(e) => setCommandValues({ ...commandValues, [field.name]: e.target.value })}
        placeholder={field.label}
      />
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Command Panel
              </CardTitle>
              <CardDescription>
                Kør FiveM commands direkte fra dashboardet - 55+ zdiscord commands
              </CardDescription>
            </div>
            <Button onClick={handleRegisterCommands} disabled={registerCommands.isPending}>
              {registerCommands.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Registrer Discord Slash Commands
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="standalone">
            <TabsList className="mb-4">
              <TabsTrigger value="standalone">Standalone ({STANDALONE_COMMANDS.length})</TabsTrigger>
              <TabsTrigger value="qbcore">QBCore ({QBCORE_COMMANDS.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="standalone">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {STANDALONE_COMMANDS.map((cmd) => (
                  <Button
                    key={cmd.name}
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => handleOpenCommand(cmd)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {cmd.icon}
                      <div className="text-left flex-1">
                        <div className="font-medium">/{cmd.name}</div>
                        <div className="text-xs text-muted-foreground">{cmd.description}</div>
                      </div>
                      {getPermissionBadge(cmd.permission)}
                    </div>
                  </Button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="qbcore">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {QBCORE_COMMANDS.map((cmd) => (
                  <Button
                    key={cmd.name}
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => handleOpenCommand(cmd)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {cmd.icon}
                      <div className="text-left flex-1">
                        <div className="font-medium">/{cmd.name}</div>
                        <div className="text-xs text-muted-foreground">{cmd.description}</div>
                      </div>
                      {getPermissionBadge(cmd.permission)}
                    </div>
                  </Button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCommand} onOpenChange={() => setSelectedCommand(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCommand?.icon}
              /{selectedCommand?.name}
            </DialogTitle>
            <DialogDescription>{selectedCommand?.description}</DialogDescription>
          </DialogHeader>

          {selectedCommand?.fields.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">Ingen parametre påkrævet</p>
          ) : (
            <div className="space-y-4">
              {selectedCommand?.fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {renderField(field)}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCommand(null)}>
              Annuller
            </Button>
            <Button onClick={handleExecute} disabled={executeCommand.isPending}>
              {executeCommand.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Kør kommando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
