import type { DocCategory, DocPage } from './types';
import { gettingStartedPages } from './pages/getting-started';
import { overviewPages } from './pages/overview';
import { serverManagementPages } from './pages/server-management';
import { moderationPages } from './pages/moderation';
import { engagementPages } from './pages/engagement';
import { communicationPages } from './pages/communication';
import { integrationsPages } from './pages/integrations';
import { advancedPages } from './pages/advanced';
import { faqPages } from './pages/faq';
import { changelogPages } from './pages/changelog';
import { contactPages } from './pages/contact';

export const docCategories: DocCategory[] = [
  { slug: 'getting-started', icon: 'Rocket', title: { da: 'Kom i gang', en: 'Getting started' }, pages: gettingStartedPages },
  { slug: 'overview', icon: 'LayoutDashboard', title: { da: 'Oversigt', en: 'Overview' }, pages: overviewPages },
  { slug: 'server-management', icon: 'Settings', title: { da: 'Serverhåndtering', en: 'Server management' }, pages: serverManagementPages },
  { slug: 'moderation', icon: 'Shield', title: { da: 'Moderation', en: 'Moderation' }, pages: moderationPages },
  { slug: 'engagement', icon: 'Sparkles', title: { da: 'Engagement', en: 'Engagement' }, pages: engagementPages },
  { slug: 'communication', icon: 'Mail', title: { da: 'Kommunikation', en: 'Communication' }, pages: communicationPages },
  { slug: 'integrations', icon: 'Globe', title: { da: 'Integrationer', en: 'Integrations' }, pages: integrationsPages },
  { slug: 'advanced', icon: 'Bot', title: { da: 'Avanceret', en: 'Advanced' }, pages: advancedPages },
  { slug: 'faq', icon: 'HelpCircle', title: { da: 'FAQ', en: 'FAQ' }, pages: faqPages },
  { slug: 'changelog', icon: 'History', title: { da: 'Changelog', en: 'Changelog' }, pages: changelogPages },
  { slug: 'contact', icon: 'MessageSquare', title: { da: 'Kontakt', en: 'Contact' }, pages: contactPages },
];

export const allDocPages: DocPage[] = docCategories.flatMap(c => c.pages);

export function findPage(category: string, slug: string): DocPage | undefined {
  return allDocPages.find(p => p.category === category && p.slug === slug);
}

export function findCategory(slug: string): DocCategory | undefined {
  return docCategories.find(c => c.slug === slug);
}
