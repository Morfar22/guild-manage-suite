import React from 'react';
import { useDiscordChannels, DiscordChannel, DiscordCategory } from '@/hooks/useDiscordChannels';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Hash, Volume2, Megaphone, MessageSquare, Loader2 } from 'lucide-react';

interface ChannelSelectProps {
  value: string | null | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
  includeCategories?: boolean;
  disabled?: boolean;
  allowedTypes?: number[];
}

const channelIcons: Record<number, React.ComponentType<{ className?: string }>> = {
  0: Hash,       // Text channel
  5: Megaphone,  // Announcement channel
  15: MessageSquare, // Forum channel
  4: Volume2,    // Category (fallback)
};

function getChannelIcon(type: number) {
  const Icon = channelIcons[type] || Hash;
  return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />;
}

export const ChannelSelect = React.forwardRef<HTMLDivElement, ChannelSelectProps>(function ChannelSelect({
  value,
  onValueChange,
  placeholder = 'Select channel',
  includeCategories = false,
  disabled = false,
  allowedTypes,
}, _ref) {
  const { data, isLoading, error, refetch, isFetching } = useDiscordChannels();

  const allChannels = data?.channels || [];
  const channels = allowedTypes?.length
    ? allChannels.filter((channel) => allowedTypes.includes(channel.type))
    : allChannels;
  const categories = data?.categories || [];

  // Group channels by category
  const groupedChannels = channels.reduce((acc, channel) => {
    const parentId = channel.parent_id || 'uncategorized';
    if (!acc[parentId]) {
      acc[parentId] = [];
    }
    acc[parentId].push(channel);
    return acc;
  }, {} as Record<string, DiscordChannel[]>);

  const getCategoryName = (id: string): string => {
    if (id === 'uncategorized') return 'Uncategorized';
    const category = categories.find((c) => c.id === id);
    return category?.name || 'Unknown category';
  };

  // Find the selected channel name
  const selectedChannel = channels.find((c) => c.id === value);
  const selectedCategory = includeCategories ? categories.find((c) => c.id === value) : null;

  if (isLoading) {
    return (
      <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading channels...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-10 w-full items-center rounded-md border border-destructive bg-background px-3 py-2 text-sm text-destructive">
        <span className="min-w-0 flex-1 truncate" title={error.message}>{error.message || "Could not fetch channels"}</span>
        <button type="button" className="ml-2 shrink-0 rounded border border-destructive/40 px-2 py-1 text-xs hover:bg-destructive/10 disabled:opacity-50" disabled={isFetching} onClick={() => void refetch()} aria-label="Retry fetching channels">
          {isFetching ? "Retrying..." : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <Select value={value || ''} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {selectedChannel && (
            <div className="flex items-center gap-2">
              {getChannelIcon(selectedChannel.type)}
              <span>{selectedChannel.name}</span>
            </div>
          )}
          {selectedCategory && (
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <span>{selectedCategory.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80 bg-popover border-border z-50">
        {includeCategories && categories.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs text-muted-foreground px-2">Kategorier</SelectLabel>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <span>{category.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {Object.entries(groupedChannels).map(([parentId, channelList]) => (
          <SelectGroup key={parentId}>
            <SelectLabel className="text-xs text-muted-foreground px-2">
              {getCategoryName(parentId)}
            </SelectLabel>
            {channelList.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                <div className="flex items-center gap-2">
                  {getChannelIcon(channel.type)}
                  <span>{channel.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}

        {channels.length === 0 && categories.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No channels found
          </div>
        )}
      </SelectContent>
    </Select>
  );
});
ChannelSelect.displayName = 'ChannelSelect';
