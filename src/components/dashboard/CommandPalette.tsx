import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CaseSensitive, FileSearch, Search, Terminal, Ticket, UserRoundSearch } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGuild } from '@/contexts/GuildContext';
import { supabase } from '@/integrations/supabase/client';
import { navGroups } from '@/lib/nav-items';
import { COMMANDS_BY_CATEGORY } from '@/types/discord';
import { getCommandSlashPath } from '@/lib/commandGrouping';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { selectedGuild } = useGuild();

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const searchData = useQuery({
    queryKey: ['global-search-data', selectedGuild?.id],
    enabled: open && !!selectedGuild?.id,
    staleTime: 30_000,
    queryFn: async () => {
      if (!selectedGuild?.id) return { tickets: [], cases: [], members: [] };

      const [ticketsResult, casesResult, sessionResult] = await Promise.all([
        supabase
          .from('tickets')
          .select('id, creator_id, creator_name, subject, status')
          .eq('guild_id', selectedGuild.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('moderation_logs')
          .select('id, target_id, target_name, action_type, status')
          .eq('guild_id', selectedGuild.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.auth.getSession(),
      ]);

      if (ticketsResult.error) throw ticketsResult.error;
      if (casesResult.error) throw casesResult.error;

      let members: Array<{
        user: { id: string; username: string; global_name: string | null };
        nick: string | null;
      }> = [];

      const token = sessionResult.data.session?.access_token;
      if (token) {
        const response = await fetch(
          `/api/public/discord-members?guildId=${selectedGuild.id}&limit=1000`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (response.ok) {
          const result = await response.json();
          members = result.members || [];
        }
      }

      return {
        tickets: ticketsResult.data ?? [],
        cases: casesResult.data ?? [],
        members,
      };
    },
  });

  const commandEntries = useMemo(
    () =>
      Object.entries(COMMANDS_BY_CATEGORY).flatMap(([category, commands]) =>
        commands.map((command) => ({
          ...command,
          category,
          slashPath: getCommandSlashPath(command.name),
        }))
      ),
    [],
  );

  const handleSelect = (to: string) => {
    setOpen(false);
    navigate({ to: to as never });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">
          {language === 'da' ? 'Søg alt...' : 'Search everything...'}
        </span>
        <kbd className="pointer-events-none hidden rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={language === 'da'
            ? 'Søg side, command, medlem, ticket eller case...'
            : 'Search page, command, member, ticket or case...'}
        />
        <CommandList className="max-h-[65vh]">
          <CommandEmpty>
            {language === 'da' ? 'Ingen resultater fundet.' : 'No results found.'}
          </CommandEmpty>

          <CommandGroup heading={language === 'da' ? 'Commands' : 'Commands'}>
            {commandEntries.map((command) => (
              <CommandItem
                key={command.name}
                value={`${command.slashPath} ${command.name} ${command.description} ${command.category}`}
                onSelect={() => handleSelect('/dashboard/commands')}
                className="cursor-pointer"
              >
                <Terminal className="mr-2 h-4 w-4 text-primary" />
                <span className="font-mono text-xs">{command.slashPath}</span>
                <span className="ml-2 truncate text-muted-foreground">{command.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {(searchData.data?.members?.length ?? 0) > 0 && (
            <CommandGroup heading={language === 'da' ? 'Medlemmer' : 'Members'}>
              {searchData.data!.members.slice(0, 100).map((member) => {
                const label = member.nick || member.user.global_name || member.user.username;
                return (
                  <CommandItem
                    key={member.user.id}
                    value={`${label} ${member.user.username} ${member.user.id}`}
                    onSelect={() => handleSelect('/dashboard/operations')}
                    className="cursor-pointer"
                  >
                    <UserRoundSearch className="mr-2 h-4 w-4" />
                    <span>{label}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{member.user.id}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {(searchData.data?.tickets?.length ?? 0) > 0 && (
            <CommandGroup heading="Tickets">
              {searchData.data!.tickets.map((ticketItem) => (
                <CommandItem
                  key={ticketItem.id}
                  value={`${ticketItem.subject || ''} ${ticketItem.creator_name || ''} ${ticketItem.creator_id} ${ticketItem.id}`}
                  onSelect={() => handleSelect(`/dashboard/tickets/${ticketItem.id}`)}
                  className="cursor-pointer"
                >
                  <Ticket className="mr-2 h-4 w-4" />
                  <span className="truncate">{ticketItem.subject || ticketItem.creator_name || 'Ticket'}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{ticketItem.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {(searchData.data?.cases?.length ?? 0) > 0 && (
            <CommandGroup heading={language === 'da' ? 'Moderation Cases' : 'Moderation Cases'}>
              {searchData.data!.cases.map((caseItem) => (
                <CommandItem
                  key={caseItem.id}
                  value={`${caseItem.target_name || ''} ${caseItem.target_id} ${caseItem.action_type} ${caseItem.status} ${caseItem.id}`}
                  onSelect={() => handleSelect('/dashboard/operations')}
                  className="cursor-pointer"
                >
                  <FileSearch className="mr-2 h-4 w-4" />
                  <span>{caseItem.target_name || caseItem.target_id}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {caseItem.action_type} · {caseItem.id.slice(0, 8)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {navGroups.map((group, idx) => (
            <CommandGroup key={idx} heading={language === 'da' ? group.labelDa : group.labelEn}>
              {group.items.map((item) => (
                <CommandItem
                  key={item.to}
                  value={`${t(item.labelKey)} ${item.to}`}
                  onSelect={() => handleSelect(item.to)}
                  className="cursor-pointer"
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  <span>{t(item.labelKey)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
