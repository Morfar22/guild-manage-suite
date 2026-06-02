import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Twitch } from 'lucide-react';

interface TwitchEmbedPreviewProps {
  streamerName: string;
  streamerAvatar?: string;
  liveMessage: string;
  streamTitle?: string;
  gameName?: string;
  viewerCount?: number;
  embedColor: string;
  showGame: boolean;
  showViewers: boolean;
  showThumbnail: boolean;
  isOffline?: boolean;
  offlineMessage?: string;
  className?: string;
}

export const TwitchEmbedPreview = forwardRef<HTMLDivElement, TwitchEmbedPreviewProps>(function TwitchEmbedPreview({
  streamerName,
  streamerAvatar,
  liveMessage,
  streamTitle = 'Just a chill stream! Come hang out 🎮',
  gameName = 'Just Chatting',
  viewerCount = 1234,
  embedColor,
  showGame,
  showViewers,
  showThumbnail,
  isOffline = false,
  offlineMessage,
  className,
}, ref) {
  // Parse message template
  const formattedMessage = (isOffline ? offlineMessage : liveMessage)?.replace(/{streamer}/g, streamerName) || 
    (isOffline ? `${streamerName} er gået offline.` : `${streamerName} er nu LIVE på Twitch!`);

  return (
    <div className={cn("font-sans", className)}>
      {/* Discord message container */}
      <div className="flex gap-4 py-2">
        {/* Bot avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#9146FF] flex items-center justify-center">
            <Twitch className="h-5 w-5 text-white" />
          </div>
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0">
          {/* Bot name and timestamp */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-primary hover:underline cursor-pointer">
              Paranox
            </span>
            <span className="bg-[#5865F2] text-white text-[10px] px-1 py-0.5 rounded font-medium">
              APP
            </span>
            <span className="text-xs text-muted-foreground">
              I dag kl. {new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Role mention */}
          <div className="mb-2">
            <span className="text-[#C9CDFB] bg-[#5865F2]/20 px-0.5 rounded hover:bg-[#5865F2]/30 cursor-pointer">
              @ 🔔 Ping
            </span>
          </div>

          {/* Embed */}
          <div 
            className="max-w-[480px] rounded-md overflow-hidden border-l-4 bg-[#2b2d31]"
            style={{ borderLeftColor: embedColor }}
          >
            <div className="p-4">
              <div className="flex gap-4">
                {/* Main content */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Author line */}
                  <div className="flex items-center gap-2">
                    {streamerAvatar ? (
                      <img 
                        src={streamerAvatar} 
                        alt={streamerName}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#9146FF]/50 flex items-center justify-center">
                        <Twitch className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-white">
                      {formattedMessage}
                    </span>
                  </div>

                  {/* Title (if live) */}
                  {!isOffline && (
                    <a 
                      href="#" 
                      className="block font-semibold text-[#00b0f4] hover:underline"
                      onClick={(e) => e.preventDefault()}
                    >
                      🔴 LIVE: {streamTitle}
                    </a>
                  )}

                  {/* Description link */}
                  {!isOffline && (
                    <p className="text-sm text-[#00b0f4] hover:underline cursor-pointer">
                      <strong>Klik her for at se streamen</strong>
                    </p>
                  )}

                  {/* Fields */}
                  {!isOffline && (
                    <div className="flex gap-6 mt-3">
                      {showGame && (
                        <div>
                          <p className="text-xs font-semibold text-[#b5bac1] mb-0.5">🎮 Spil</p>
                          <p className="text-sm text-[#dbdee1]">{gameName}</p>
                        </div>
                      )}
                      {showViewers && (
                        <div>
                          <p className="text-xs font-semibold text-[#b5bac1] mb-0.5">👀 Seere</p>
                          <p className="text-sm text-[#dbdee1]">{viewerCount.toLocaleString()}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-[#b5bac1] mb-0.5">⏱️ Uptime</p>
                        <p className="text-sm text-[#dbdee1]">45m</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Thumbnail (profile image) */}
                {streamerAvatar && (
                  <div className="flex-shrink-0">
                    <img 
                      src={streamerAvatar} 
                      alt={streamerName}
                      className="w-20 h-20 rounded object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Stream thumbnail */}
              {!isOffline && showThumbnail && (
                <div className="mt-4">
                  <div className="relative rounded overflow-hidden bg-black aspect-video">
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#9146FF]/20 to-[#9146FF]/5">
                      <div className="text-center">
                        <Twitch className="h-12 w-12 text-[#9146FF]/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Stream Thumbnail</p>
                      </div>
                    </div>
                    {/* Live indicator */}
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                      LIVE
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center gap-2 mt-3 text-xs text-[#949ba4]">
                <img 
                  src="https://static.twitchcdn.net/assets/favicon-32-d6025c14e900565d6177.png" 
                  alt="Twitch"
                  className="w-4 h-4"
                />
                <span>Twitch • DA</span>
                <span>•</span>
                <span>
                  {new Date().toLocaleDateString('da-DK', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
