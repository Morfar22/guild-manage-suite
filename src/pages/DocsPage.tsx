import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { findCategory, findPage } from '@/docs';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';

export default function DocsPage() {
  const { category = '', slug = '' } = useParams();
  const { language } = useLanguage();
  const page = findPage(category, slug);
  const cat = findCategory(category);

  // Find next/prev page
  const { prev, next } = useMemo(() => {
    if (!cat || !page) return { prev: null, next: null };
    const idx = cat.pages.findIndex((p) => p.slug === slug);
    return {
      prev: idx > 0 ? cat.pages[idx - 1] : null,
      next: idx < cat.pages.length - 1 ? cat.pages[idx + 1] : null,
    };
  }, [cat, page, slug]);

  if (!page || !cat) {
    return (
      <div className="text-center">
        <Helmet>
          <title>{language === 'da' ? 'Side ikke fundet – Paranox Docs' : 'Page not found – Paranox Docs'}</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <h1 className="text-2xl font-bold">{language === 'da' ? 'Side ikke fundet' : 'Page not found'}</h1>
        <Link to="/docs" className="mt-4 inline-block text-primary hover:underline">
          {language === 'da' ? 'Tilbage til docs' : 'Back to docs'}
        </Link>
      </div>
    );
  }

  const pageTitle = `${page.title[language]} – Paranox Docs`;
  const pageDescription = page.description[language].slice(0, 155);
  const pageUrl = `https://bot.nethost-solutions.dk/docs/${category}/${slug}`;
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.title[language],
    description: pageDescription,
    author: { '@type': 'Organization', name: 'Paranox' },
    mainEntityOfPage: pageUrl,
  };


  return (
    <article className="mx-auto max-w-3xl">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <script type="application/ld+json">{JSON.stringify(articleLd)}</script>
      </Helmet>
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/docs" className="hover:text-foreground">Docs</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{cat.title[language]}</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{page.title[language]}</span>
      </nav>

      <header className="mb-8 border-b pb-6">
        <h1 className="mb-3 text-4xl font-bold tracking-tight">{page.title[language]}</h1>
        <p className="text-lg text-muted-foreground">{page.description[language]}</p>
      </header>

      <div className="space-y-8">
        {page.sections?.map((s, i) => (
          <section key={i}>
            <h2 className="mb-3 text-2xl font-semibold">{s.heading[language]}</h2>
            <div className="whitespace-pre-line leading-relaxed text-muted-foreground">
              {s.body[language]}
            </div>
          </section>
        ))}

        {page.setupSteps && page.setupSteps.length > 0 && (
          <section>
            <h2 className="mb-3 text-2xl font-semibold">
              {language === 'da' ? 'Opsætning' : 'Setup'}
            </h2>
            <ol className="space-y-3">
              {page.setupSteps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed text-muted-foreground">{step[language]}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {page.commands && page.commands.length > 0 && (
          <section>
            <h2 className="mb-3 text-2xl font-semibold">
              {language === 'da' ? 'Kommandoer' : 'Commands'}
            </h2>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'da' ? 'Kommando' : 'Command'}</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>{language === 'da' ? 'Beskrivelse' : 'Description'}</TableHead>
                    <TableHead>{language === 'da' ? 'Tilladelse' : 'Permission'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.commands.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="font-mono">{c.name}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {c.prefix ?? '—'}
                      </TableCell>
                      <TableCell>{c.description[language]}</TableCell>
                      <TableCell>
                        {c.permission ? <Badge variant="outline">{c.permission}</Badge> : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        {page.tips && page.tips.length > 0 && (
          <section>
            <h2 className="mb-3 text-2xl font-semibold">Tips</h2>
            <ul className="space-y-2">
              {page.tips.map((tip, i) => (
                <li
                  key={i}
                  className="rounded-lg border-l-4 border-primary bg-primary/5 p-4 text-muted-foreground"
                >
                  💡 {tip[language]}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <nav className="mt-12 flex items-center justify-between gap-4 border-t pt-6">
        {prev ? (
          <Link
            to={`/docs/${prev.category}/${prev.slug}`}
            className="group flex flex-col rounded-lg border p-4 transition-colors hover:border-primary/50"
          >
            <span className="text-xs text-muted-foreground">{language === 'da' ? 'Forrige' : 'Previous'}</span>
            <span className="font-medium group-hover:text-primary">← {prev.title[language]}</span>
          </Link>
        ) : <div />}
        {next ? (
          <Link
            to={`/docs/${next.category}/${next.slug}`}
            className="group ml-auto flex flex-col rounded-lg border p-4 text-right transition-colors hover:border-primary/50"
          >
            <span className="text-xs text-muted-foreground">{language === 'da' ? 'Næste' : 'Next'}</span>
            <span className="flex items-center gap-1 font-medium group-hover:text-primary">
              {next.title[language]} <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ) : <div />}
      </nav>
    </article>
  );
}
