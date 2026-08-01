import { useLocation, Link } from '@tanstack/react-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { navGroups } from '@/lib/nav-items';
import { ChevronRight, Home } from 'lucide-react';

export function Breadcrumbs() {
  const location = useLocation();
  const { t, language } = useLanguage();

  if (location.pathname === '/dashboard') return null;

  // Find the matching nav item and its group
  let groupLabel = '';
  let itemLabel = '';

  for (const group of navGroups) {
    const match = group.items.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    );
    if (match) {
      groupLabel = language === 'da' ? group.labelDa : group.labelEn;
      itemLabel = t(match.labelKey);
      break;
    }
  }

  if (!itemLabel) return null;

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
      <Link
        to="/dashboard"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span>Dashboard</span>
      </Link>
      {groupLabel && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span>{groupLabel}</span>
        </>
      )}
      <ChevronRight className="h-3 w-3" />
      <span className="text-foreground font-medium">{itemLabel}</span>
    </nav>
  );
}
