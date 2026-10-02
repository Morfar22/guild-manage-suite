import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Bot, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LegalPageLayout({
  title,
  subtitle,
  updatedAt,
  children,
}: {
  title: string;
  subtitle: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2" aria-label="GuildOS Bot forside">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-blurple shadow-glow">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold">GuildOS Bot</span>
          </Link>

          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tilbage
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 border-b border-border/60 pb-8">
          <p className="mb-2 text-sm font-medium text-primary">GuildOS Bot</p>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {subtitle}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">Senest opdateret: {updatedAt}</p>
        </div>

        <div className="space-y-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_p]:leading-7 [&_p]:text-muted-foreground [&_li]:leading-7 [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6">
          {children}
        </div>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 text-sm text-muted-foreground sm:px-6">
          <span>© {new Date().getFullYear()} GuildOS Bot</span>
          <Link to="/terms" className="hover:text-foreground">Vilkår</Link>
          <Link to="/privacy" className="hover:text-foreground">Privatliv</Link>
          <Link to="/docs" className="hover:text-foreground">Dokumentation</Link>
        </div>
      </footer>
    </div>
  );
}
