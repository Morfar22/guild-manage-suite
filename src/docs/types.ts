export interface DocCommand {
  name: string;
  prefix?: string;
  description: { da: string; en: string };
  permission?: string;
}

export interface DocSetupStep {
  da: string;
  en: string;
}

export interface DocSection {
  heading: { da: string; en: string };
  body: { da: string; en: string };
}

export interface DocPage {
  slug: string;
  category: string;
  icon?: string;
  title: { da: string; en: string };
  description: { da: string; en: string };
  sections?: DocSection[];
  commands?: DocCommand[];
  setupSteps?: DocSetupStep[];
  tips?: { da: string; en: string }[];
}

export interface DocCategory {
  slug: string;
  title: { da: string; en: string };
  icon: string;
  pages: DocPage[];
}
