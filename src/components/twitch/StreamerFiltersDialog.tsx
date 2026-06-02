import { useState, useEffect } from 'react';
import { TwitchStreamer } from '@/hooks/useTwitchStreamers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, X, Plus, Filter, Clock, Gamepad2, Eye, MessageSquare, Palette } from 'lucide-react';

interface StreamerFiltersDialogProps {
  streamer: (TwitchStreamer & {
    min_viewers?: number;
    allowed_games?: string[];
    blocked_games?: string[];
    custom_live_message?: string;
    custom_embed_color?: string;
    notification_cooldown_minutes?: number;
  }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<TwitchStreamer>) => Promise<boolean>;
  saving: boolean;
}

export function StreamerFiltersDialog({
  streamer,
  open,
  onOpenChange,
  onSave,
  saving,
}: StreamerFiltersDialogProps) {
  const [minViewers, setMinViewers] = useState(0);
  const [allowedGames, setAllowedGames] = useState<string[]>([]);
  const [blockedGames, setBlockedGames] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [customColor, setCustomColor] = useState('#9146FF');
  const [cooldownMinutes, setCooldownMinutes] = useState(0);
  const [newAllowedGame, setNewAllowedGame] = useState('');
  const [newBlockedGame, setNewBlockedGame] = useState('');

  useEffect(() => {
    if (streamer) {
      setMinViewers(streamer.min_viewers || 0);
      setAllowedGames(streamer.allowed_games || []);
      setBlockedGames(streamer.blocked_games || []);
      setCustomMessage(streamer.custom_live_message || '');
      setCustomColor(streamer.custom_embed_color || '#9146FF');
      setCooldownMinutes(streamer.notification_cooldown_minutes || 0);
    }
  }, [streamer]);

  const handleAddAllowedGame = () => {
    if (newAllowedGame.trim() && !allowedGames.includes(newAllowedGame.trim())) {
      setAllowedGames([...allowedGames, newAllowedGame.trim()]);
      setNewAllowedGame('');
    }
  };

  const handleAddBlockedGame = () => {
    if (newBlockedGame.trim() && !blockedGames.includes(newBlockedGame.trim())) {
      setBlockedGames([...blockedGames, newBlockedGame.trim()]);
      setNewBlockedGame('');
    }
  };

  const handleSave = async () => {
    const success = await onSave({
      min_viewers: minViewers,
      allowed_games: allowedGames,
      blocked_games: blockedGames,
      custom_live_message: customMessage || null,
      custom_embed_color: customColor || null,
      notification_cooldown_minutes: cooldownMinutes,
    } as any);
    if (success) {
      onOpenChange(false);
    }
  };

  if (!streamer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtre for {streamer.display_name || streamer.twitch_username}
          </DialogTitle>
          <DialogDescription>
            Konfigurer avancerede regler for denne streamer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Minimum Viewers */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Minimum Seere
            </Label>
            <Input
              type="number"
              min={0}
              value={minViewers}
              onChange={(e) => setMinViewers(parseInt(e.target.value) || 0)}
              placeholder="0 = ingen grænse"
            />
            <p className="text-xs text-muted-foreground">
              Kun send notifikation hvis streamen har mindst dette antal seere
            </p>
          </div>

          <Separator />

          {/* Allowed Games */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              Kun disse spil (whitelist)
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Tilføj spil..."
                value={newAllowedGame}
                onChange={(e) => setNewAllowedGame(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAllowedGame()}
              />
              <Button size="icon" variant="outline" onClick={handleAddAllowedGame}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {allowedGames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {allowedGames.map((game) => (
                  <Badge key={game} variant="secondary" className="gap-1">
                    {game}
                    <button onClick={() => setAllowedGames(allowedGames.filter(g => g !== game))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Lad være tom for at tillade alle spil
            </p>
          </div>

          {/* Blocked Games */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              Bloker disse spil (blacklist)
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Bloker spil..."
                value={newBlockedGame}
                onChange={(e) => setNewBlockedGame(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddBlockedGame()}
              />
              <Button size="icon" variant="outline" onClick={handleAddBlockedGame}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {blockedGames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {blockedGames.map((game) => (
                  <Badge key={game} variant="destructive" className="gap-1">
                    {game}
                    <button onClick={() => setBlockedGames(blockedGames.filter(g => g !== game))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Cooldown */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Notifikations Cooldown (minutter)
            </Label>
            <Input
              type="number"
              min={0}
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(parseInt(e.target.value) || 0)}
              placeholder="0 = ingen cooldown"
            />
            <p className="text-xs text-muted-foreground">
              Minimum ventetid mellem notifikationer for denne streamer
            </p>
          </div>

          <Separator />

          {/* Custom Message */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Custom Live Besked (valgfrit)
            </Label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Brug {streamer} for navn. Lad være tom for global besked."
              className="min-h-[80px]"
            />
          </div>

          {/* Custom Color */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Custom Embed Farve
            </Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="#9146FF"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Gem Filtre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
