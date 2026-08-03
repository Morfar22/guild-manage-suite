import { createRootRouteWithContext, Outlet, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { GuildProvider } from "@/contexts/GuildContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import appCss from "@/styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  errorComponent: ErrorFallback,
  head: () => ({
    meta: [
      { charSet: "UTF-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { name: "description", content: "Alt-i-én Discord bot med 49+ moduler: moderation, tickets, AI, leveling, FiveM og mere. Sikker, hurtig og fuldt tilpasselig. Kom i gang gratis." },
      { name: "author", content: "Paranox" },
      { name: "keywords", content: "Discord bot, moderation, tickets, AI chat, leveling, FiveM, dashboard" },
      { name: "theme-color", content: "#5865F2" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bot.nethost-solutions.dk/" },
      { property: "og:title", content: "Paranox — Den smarteste Discord bot platform" },
      { property: "og:description", content: "Alt-i-én Discord bot med 49+ moduler: moderation, tickets, AI, leveling, FiveM og mere." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/cd28fa51-9f36-481b-9dfc-34c5b5ad37c1" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Paranox — Den smarteste Discord bot platform" },
      { name: "twitter:description", content: "Alt-i-én Discord bot med 49+ moduler: moderation, tickets, AI, leveling, FiveM og mere." },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/cd28fa51-9f36-481b-9dfc-34c5b5ad37c1" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://cdn.gpteng.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://cdn.gpteng.co" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Paranox",
          url: "https://bot.nethost-solutions.dk/",
          logo: "https://bot.nethost-solutions.dk/favicon.ico",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Paranox",
          url: "https://bot.nethost-solutions.dk/",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://bot.nethost-solutions.dk/docs?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Paranox",
          applicationCategory: "Discord Bot",
          operatingSystem: "Web, Discord",
          description: "Alt-i-én Discord bot platform med 49+ moduler: moderation, tickets, AI, leveling, FiveM integration og mere.",
          url: "https://bot.nethost-solutions.dk/",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "DKK",
          },
        }),
      },
    ],
  }),
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <ErrorBoundary>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <AuthProvider>
                  <GuildProvider>
                    <LanguageProvider>
                      <main className="min-h-screen">
                        <Outlet />
                      </main>
                    </LanguageProvider>
                  </GuildProvider>
                </AuthProvider>
              </TooltipProvider>
            </ThemeProvider>
          </ErrorBoundary>
        </HelmetProvider>
      </QueryClientProvider>
    </RootDocument>
  );
}



function ErrorFallback({ error }: { error: Error }) {
  reportLovableError(error, { route: "/" });
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="mb-2 text-2xl font-bold">This page didn't load</h1>
      <p className="text-muted-foreground">
        Something went wrong on our end. You can try refreshing or head back home.
      </p>
      <div className="mt-6 flex gap-4">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Try again
        </button>
        <a href="/" className="rounded-md border border-border px-4 py-2">
          Go home
        </a>
      </div>
      {import.meta.env.DEV && (
        <pre className="mt-8 max-w-2xl overflow-auto rounded-md bg-muted p-4 text-left text-sm">
          {error.message}
          {"\n"}
          {error.stack}
        </pre>
      )}
    </div>
  );
}
