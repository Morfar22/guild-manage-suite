import { Link, Outlet } from '@tanstack/react-router';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, BookOpen, ArrowLeft, Languages } from 'lucide-react';
import { DocsSidebar } from './DocsSidebar';
import { DocsSearch } from './DocsSearch';
import { useLanguage } from '@/contexts/LanguageContext';
import { useState } from 'react';

export function DocsLayout() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto p-0">
              <div className="border-b p-4">
                <Link to="/docs" className="flex items-center gap-2 font-semibold">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Docs
                </Link>
              </div>
              <DocsSidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link to="/docs" className="flex items-center gap-2 font-semibold">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">Documentation</span>
          </Link>

          <div className="ml-auto flex flex-1 items-center justify-end gap-3">
            <div className="hidden flex-1 justify-center md:flex">
              <DocsSearch />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === 'da' ? 'en' : 'da')}
            >
              <Languages className="mr-1.5 h-4 w-4" />
              {language.toUpperCase()}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                {language === 'da' ? 'Til app' : 'To app'}
              </Link>
            </Button>
          </div>
        </div>
        <div className="border-t p-3 md:hidden">
          <DocsSearch />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r lg:block">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            <DocsSidebar />
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-8 md:px-8 lg:px-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
