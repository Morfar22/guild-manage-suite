import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { navGroups } from '@/lib/nav-items';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Search } from 'lucide-react';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      {/* Search trigger button in sidebar */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">
          {language === 'da' ? 'Søg...' : 'Search...'}
        </span>
        <kbd className="pointer-events-none hidden rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={language === 'da' ? 'Søg efter sider...' : 'Search pages...'} />
        <CommandList>
          <CommandEmpty>
            {language === 'da' ? 'Ingen resultater fundet.' : 'No results found.'}
          </CommandEmpty>
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
