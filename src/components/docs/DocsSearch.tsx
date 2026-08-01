import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import Fuse from 'fuse.js';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { allDocPages } from '@/docs';

export function DocsSearch() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const fuse = useMemo(
    () =>
      new Fuse(
        allDocPages.map((p) => ({
          ...p,
          searchTitle: p.title[language],
          searchDesc: p.description[language],
          searchCmds: p.commands?.map((c) => `${c.name} ${c.prefix ?? ''}`).join(' ') ?? '',
        })),
        {
          keys: ['searchTitle', 'searchDesc', 'searchCmds'],
          threshold: 0.4,
        }
      ),
    [language]
  );

  const results = query ? fuse.search(query).slice(0, 8) : [];

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t('docs.searchPlaceholder' as any) || 'Søg i docs... (⌘K)'}
        className="pl-9 pr-9"
      />
      {query && (
        <button
          onClick={() => setQuery('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-auto rounded-lg border bg-popover shadow-lg">
          {results.map(({ item }) => (
            <button
              key={`${item.category}-${item.slug}`}
              onMouseDown={() => {
                navigate(`/docs/${item.category}/${item.slug}`);
                setQuery('');
                setOpen(false);
              }}
              className="block w-full border-b px-4 py-3 text-left last:border-b-0 hover:bg-muted"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{item.category}</div>
              <div className="font-medium">{item.title[language]}</div>
              <div className="line-clamp-1 text-sm text-muted-foreground">{item.description[language]}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
