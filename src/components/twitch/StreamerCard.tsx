import { useState } from 'react';
import { TwitchStreamer } from '@/hooks/useTwitchStreamers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Twitch,
  MoreVertical,
  Edit2,
  Trash2,
  Bell,
  BellOff,
  ExternalLink,
  Gamepad2,
  Eye,
  Clock,
  TrendingUp,
  PlayCircle,
  Settings2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

interface StreamerCardProps {
  streamer: TwitchStreamer & {
    stream_count?: number;
    total_viewers?: number;
    peak_viewers?: number;
    total_stream_minutes?: number;
    last_game_name?: string;
    last_stream_title?: string;
    is_muted?: boolean;
  };
  channelName?: string;
  roleName?: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleMute: () => void;
  onTestNotification: () => void;
  onConfigureFilters: () => void;
}

export function StreamerCard({
  streamer,
  channelName,
  roleName,
  onEdit,
  onDelete,
  onToggleMute,
  onTestNotification,
  onConfigureFilters,
}: StreamerCardProps) {
  const avgViewers = streamer.stream_count && streamer.total_viewers 
    ? Math.round(streamer.total_viewers / streamer.stream_count) 
    : 0;
  
  const totalHours = streamer.total_stream_minutes 
    ? Math.round(streamer.total_stream_minutes / 60) 
    : 0;

  return (
    <Card className={`group relative overflow-hidden transition-all hover:shadow-lg ${
      streamer.is_live ? 'ring-2 ring-destructive/50' : ''
    } ${streamer.is_muted ? 'opacity-60' : ''}`}>
      {/* Live indicator bar */}
      {streamer.is_live && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive to-destructive/80 animate-pulse" />
      )}
      
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {streamer.profile_image_url ? (
              <img
                src={streamer.profile_image_url}
                alt={streamer.display_name || streamer.twitch_username}
                className="w-14 h-14 rounded-full ring-2 ring-background"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#9146FF]/20 flex items-center justify-center ring-2 ring-background">
                <Twitch className="h-7 w-7 text-[#9146FF]" />
              </div>
            )}
            {streamer.is_live && (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/75" />
                <span className="relative inline-flex rounded-full h-5 w-5 bg-destructive items-center justify-center">
                  <span className="text-[8px] font-bold text-destructive-foreground">LIVE</span>
                </span>
              </span>
            )}
            {streamer.is_muted && !streamer.is_live && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-muted rounded-full flex items-center justify-center">
                <BellOff className="h-3 w-3 text-muted-foreground" />
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">
                {streamer.display_name || streamer.twitch_username}
              </h3>
              <a
                href={`https://twitch.tv/${streamer.twitch_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </a>
            </div>

            {/* Current stream info */}
            {streamer.is_live && streamer.last_stream_title && (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {streamer.last_stream_title}
              </p>
            )}

            {/* Channel & Role */}
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>#{channelName || 'ukendt'}</span>
              {roleName && (
                <>
                  <span>•</span>
                  <span>@{roleName}</span>
                </>
              )}
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {streamer.last_game_name && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Gamepad2 className="h-3 w-3" />
                      <span className="truncate max-w-[80px]">{streamer.last_game_name}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Sidst spillede: {streamer.last_game_name}</TooltipContent>
                </Tooltip>
              )}

              {(streamer.stream_count ?? 0) > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <PlayCircle className="h-3 w-3" />
                      <span>{streamer.stream_count} streams</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Antal trackede streams</TooltipContent>
                </Tooltip>
              )}

              {avgViewers > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      <span>~{avgViewers.toLocaleString()}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Gennemsnitlige seere</TooltipContent>
                </Tooltip>
              )}

              {(streamer.peak_viewers ?? 0) > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      <span>{streamer.peak_viewers?.toLocaleString()}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Peak seere</TooltipContent>
                </Tooltip>
              )}

              {totalHours > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{totalHours}t</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Total stream tid tracket</TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Last live */}
            {streamer.last_went_live_at && !streamer.is_live && (
              <p className="text-xs text-muted-foreground mt-2">
                Sidst live {formatDistanceToNow(new Date(streamer.last_went_live_at), { 
                  addSuffix: true, 
                  locale: da 
                })}
              </p>
            )}
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Rediger
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onConfigureFilters}>
                <Settings2 className="h-4 w-4 mr-2" />
                Filtre & Regler
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleMute}>
                {streamer.is_muted ? (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Slå notifikationer til
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4 mr-2" />
                    Mute notifikationer
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTestNotification}>
                <PlayCircle className="h-4 w-4 mr-2" />
                Test notifikation
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Fjern
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
