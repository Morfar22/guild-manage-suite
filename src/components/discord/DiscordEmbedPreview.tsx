import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface EmbedButton {
  label: string;
  url: string;
  emoji?: string;
}

interface DiscordEmbedPreviewProps {
  author?: {
    name: string;
    icon_url?: string;
  };
  title?: string;
  description: string;
  color?: string;
  thumbnail?: string;
  fields?: EmbedField[];
  footer?: string;
  timestamp?: boolean;
  buttons?: EmbedButton[];
  className?: string;
}

export function DiscordEmbedPreview({
  author,
  title,
  description,
  color = '#5865F2',
  thumbnail,
  fields = [],
  footer,
  timestamp = true,
  buttons = [],
  className,
}: DiscordEmbedPreviewProps) {
  return (
    <div className={cn("font-sans", className)}>
      {/* Discord message container */}
      <div className="flex gap-4 py-2">
        {/* Bot avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">B</span>
          </div>
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0">
          {/* Bot name and timestamp */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-primary hover:underline cursor-pointer">
              BotDash
            </span>
            <span className="bg-primary/20 text-primary text-[10px] px-1 py-0.5 rounded font-medium">
              BOT
            </span>
            <span className="text-xs text-muted-foreground">
              I dag kl. {new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Embed */}
          <div 
            className="mt-1 max-w-[520px] rounded overflow-hidden border-l-4"
            style={{ 
              borderLeftColor: color,
              backgroundColor: 'hsl(var(--card) / 0.8)'
            }}
          >
            <div className="p-3 space-y-2">
              {/* Author */}
              {author && (
                <div className="flex items-center gap-2">
                  {author.icon_url && (
                    <img 
                      src={author.icon_url} 
                      alt="" 
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {author.name}
                  </span>
                </div>
              )}

              {/* Title */}
              {title && (
                <h4 className="font-semibold text-foreground">
                  {title}
                </h4>
              )}

              {/* Description */}
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {description}
              </p>

              {/* Fields */}
              {fields.length > 0 && (
                <div className="grid gap-2 mt-2" style={{ 
                  gridTemplateColumns: 'repeat(3, 1fr)' 
                }}>
                  {fields.map((field, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "min-w-0",
                        !field.inline && "col-span-3"
                      )}
                    >
                      <p className="text-xs font-semibold text-foreground mb-0.5">
                        {field.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {field.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Thumbnail */}
              {thumbnail && (
                <div className="absolute top-3 right-3">
                  <img 
                    src={thumbnail} 
                    alt="" 
                    className="w-20 h-20 rounded object-cover"
                  />
                </div>
              )}

              {/* Footer */}
              {(footer || timestamp) && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2">
                  {footer && <span>{footer}</span>}
                  {footer && timestamp && <span>•</span>}
                  {timestamp && (
                    <span>
                      {new Date().toLocaleDateString('da-DK', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Row - Link Buttons */}
          {buttons.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1 max-w-[520px]">
              {buttons.map((btn, i) => (
                <a
                  key={i}
                  href={btn.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium bg-[#4e5058] hover:bg-[#6d6f78] text-white transition-colors"
                >
                  {btn.emoji && <span>{btn.emoji}</span>}
                  {btn.label}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DiscordMessagePreviewProps {
  content: string;
  isTest?: boolean;
  className?: string;
}

export function DiscordMessagePreview({
  content,
  isTest = false,
  className,
}: DiscordMessagePreviewProps) {
  return (
    <div className={cn("font-sans", className)}>
      <div className="flex gap-4 py-2">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">B</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-primary hover:underline cursor-pointer">
              BotDash
            </span>
            <span className="bg-primary/20 text-primary text-[10px] px-1 py-0.5 rounded font-medium">
              BOT
            </span>
            <span className="text-xs text-muted-foreground">
              I dag kl. {new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <p className="text-sm text-foreground whitespace-pre-wrap">
            {isTest && <span className="font-bold">🧪 TEST - </span>}
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}
