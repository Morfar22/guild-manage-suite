import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { docCategories } from '@/docs';
import * as Icons from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Helmet } from 'react-helmet-async';

export default function Docs() {
  const { language } = useLanguage();

  const title = language === 'da' ? 'Dokumentation – Paranox' : 'Documentation – Paranox';
  const description = language === 'da'
    ? 'Komplet dokumentation for Paranox Discord bot — opsætning, moduler, kommandoer og avancerede features.'
    : 'Complete documentation for the Paranox Discord bot — setup, modules, commands and advanced features.';

  return (
    <div>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://bot.nethost-solutions.dk/docs" />
        <meta property="og:url" content="https://bot.nethost-solutions.dk/docs" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
      </Helmet>
      <header className="mb-10">
        <h1 className="mb-3 text-4xl font-bold tracking-tight">
          {language === 'da' ? 'Dokumentation' : 'Documentation'}
        </h1>
        <p className="text-lg text-muted-foreground">
          {language === 'da'
            ? 'Alt du behøver at vide om botten — fra opsætning til avancerede features.'
            : 'Everything you need to know about the bot — from setup to advanced features.'}
        </p>
      </header>

      <section aria-labelledby="doc-categories-heading">
        <h2 id="doc-categories-heading" className="mb-4 text-2xl font-semibold">
          {language === 'da' ? 'Kategorier' : 'Categories'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docCategories.map((cat) => {
            const Icon = (Icons as any)[cat.icon] ?? Icons.Folder;
            const firstPage = cat.pages[0];
            return (
              <Link key={cat.slug} to={`/docs/${cat.slug}/${firstPage.slug}`}>
                <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/40">
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle>{cat.title[language]}</CardTitle>
                    <CardDescription>
                      {cat.pages.length} {language === 'da' ? 'sider' : 'pages'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {cat.pages.slice(0, 4).map((p) => (
                        <li key={p.slug} className="line-clamp-1">
                          • {p.title[language]}
                        </li>
                      ))}
                      {cat.pages.length > 4 && (
                        <li className="text-xs italic">
                          +{cat.pages.length - 4} {language === 'da' ? 'flere sider' : 'more pages'}
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

