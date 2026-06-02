import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { docCategories } from '@/docs';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocsSidebarProps {
  onNavigate?: () => void;
}

export function DocsSidebar({ onNavigate }: DocsSidebarProps) {
  const { language } = useLanguage();
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-col gap-6 p-4 text-sm">
      {docCategories.map((cat) => {
        const Icon = (Icons as any)[cat.icon] ?? Icons.Folder;
        return (
          <div key={cat.slug}>
            <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {cat.title[language]}
            </div>
            <ul className="flex flex-col gap-0.5">
              {cat.pages.map((page) => {
                const to = `/docs/${cat.slug}/${page.slug}`;
                const active = pathname === to;
                return (
                  <li key={page.slug}>
                    <Link
                      to={to}
                      onClick={onNavigate}
                      className={cn(
                        'block rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                        active && 'bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary'
                      )}
                    >
                      {page.title[language]}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
