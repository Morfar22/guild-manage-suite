import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LayoutTemplate } from 'lucide-react';
import { CategoryFormData } from './CategoryForm';

export interface CategoryTemplate {
  name: string;
  description: string;
  emoji: string;
  ticket_type: 'support' | 'application';
  welcome_message: string;
  questions: { label: string; placeholder: string; required: boolean; style: 'short' | 'paragraph' }[];
}

const templates: CategoryTemplate[] = [
  {
    name: 'General Support',
    description: 'General questions and help requests',
    emoji: '🎫',
    ticket_type: 'support',
    welcome_message: 'Thank you for reaching out! A staff member will assist you shortly.',
    questions: [
      { label: 'What do you need help with?', placeholder: 'Describe your issue...', required: true, style: 'paragraph' },
    ],
  },
  {
    name: 'Bug Report',
    description: 'Report bugs or technical issues',
    emoji: '🐛',
    ticket_type: 'support',
    welcome_message: 'Thank you for reporting this bug. We will look into it as soon as possible.',
    questions: [
      { label: 'What happened?', placeholder: 'Describe the bug...', required: true, style: 'paragraph' },
      { label: 'Steps to reproduce', placeholder: '1. Go to... 2. Click on...', required: false, style: 'paragraph' },
      { label: 'Expected behavior', placeholder: 'What should have happened?', required: false, style: 'short' },
    ],
  },
  {
    name: 'Staff Application',
    description: 'Apply for a staff position',
    emoji: '📋',
    ticket_type: 'application',
    welcome_message: 'Thank you for your interest in joining our team! Please answer the questions below.',
    questions: [
      { label: 'How old are you?', placeholder: 'Your age', required: true, style: 'short' },
      { label: 'Why do you want to be staff?', placeholder: 'Tell us your motivation...', required: true, style: 'paragraph' },
      { label: 'Do you have previous experience?', placeholder: 'Describe any relevant experience...', required: true, style: 'paragraph' },
      { label: 'How many hours per week can you dedicate?', placeholder: 'e.g. 10-15 hours', required: true, style: 'short' },
    ],
  },
  {
    name: 'Player Report',
    description: 'Report a player for rule violations',
    emoji: '⚠️',
    ticket_type: 'support',
    welcome_message: 'Thank you for your report. Our moderation team will review it shortly.',
    questions: [
      { label: 'Who are you reporting?', placeholder: 'Username or ID', required: true, style: 'short' },
      { label: 'What rule was broken?', placeholder: 'Describe the violation...', required: true, style: 'paragraph' },
      { label: 'Do you have evidence?', placeholder: 'Links to screenshots/videos...', required: false, style: 'paragraph' },
    ],
  },
  {
    name: 'Partnership Request',
    description: 'Request a partnership with our server',
    emoji: '🤝',
    ticket_type: 'support',
    welcome_message: 'Thank you for your partnership interest! We will review your request.',
    questions: [
      { label: 'Server name', placeholder: 'Your server name', required: true, style: 'short' },
      { label: 'Server invite link', placeholder: 'discord.gg/...', required: true, style: 'short' },
      { label: 'Member count', placeholder: 'e.g. 500', required: true, style: 'short' },
      { label: 'Why should we partner?', placeholder: 'Tell us about your server...', required: true, style: 'paragraph' },
    ],
  },
  {
    name: 'Whitelist Application',
    description: 'Apply for server whitelist access',
    emoji: '✅',
    ticket_type: 'application',
    welcome_message: 'Thank you for applying! Please fill out the form below and wait for a staff member to review.',
    questions: [
      { label: 'In-game name', placeholder: 'Your character name', required: true, style: 'short' },
      { label: 'Age', placeholder: 'Your age', required: true, style: 'short' },
      { label: 'Why do you want to join?', placeholder: 'Tell us about yourself...', required: true, style: 'paragraph' },
      { label: 'Do you have RP experience?', placeholder: 'Describe your experience...', required: false, style: 'paragraph' },
    ],
  },
];

interface CategoryTemplatesProps {
  onUseTemplate: (template: CategoryFormData) => void;
}

export default function CategoryTemplates({ onUseTemplate }: CategoryTemplatesProps) {
  const handleUse = (t: CategoryTemplate) => {
    onUseTemplate({
      name: t.name,
      description: t.description,
      emoji: t.emoji,
      ticket_type: t.ticket_type,
      welcome_message: t.welcome_message,
      staff_role_id: '',
      questions: t.questions,
    });
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutTemplate className="h-5 w-5" />
          Templates
        </CardTitle>
        <CardDescription>
          Quick-start with a pre-configured category template
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.name}
              className="flex flex-col justify-between rounded-lg border border-border/50 bg-background/50 p-4 space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{t.emoji}</span>
                  <span className="font-medium text-sm">{t.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.description}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {t.ticket_type === 'support' ? 'Support' : 'Application'}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {t.questions.length} question{t.questions.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => handleUse(t)}>
                Use Template
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
