import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Target } from 'lucide-react';
import type { EmbedData } from '@/hooks/useSavedEmbeds';

interface Props {
  onGenerate: (embed: EmbedData) => void;
}

export function buildProgressBar(current: number, goal: number, length = 16): string {
  const pct = goal > 0 ? Math.max(0, Math.min(1, current / goal)) : 0;
  const filled = Math.round(pct * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

export function DonationGoalDialog({ onGenerate }: Props) {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState('Ny VPS Server');
  const [description, setDescription] = useState('Hjælp os med at opgradere vores hosting!');
  const [goal, setGoal] = useState(1000);
  const [current, setCurrent] = useState(0);
  const [currency, setCurrency] = useState('kr');
  const [link, setLink] = useState('https://');
  const [linkLabel, setLinkLabel] = useState('💝 Donér her');
  const [color, setColor] = useState('#22c55e');

  const handleGenerate = () => {
    const pct = goal > 0 ? Math.round((current / goal) * 100) : 0;
    const bar = buildProgressBar(current, goal);

    const embed: EmbedData = {
      title: `🎯 Donation Mål: ${item}`,
      description: description,
      color,
      timestamp: true,
      fields: [
        { name: '🛒 Hvad købes', value: item, inline: true },
        { name: '💰 Pris', value: `${goal.toLocaleString('da-DK')} ${currency}`, inline: true },
        { name: '📊 Indsamlet', value: `${current.toLocaleString('da-DK')} ${currency}`, inline: true },
        { name: `Progress — ${pct}%`, value: `\`${bar}\`\n**${current.toLocaleString('da-DK')} / ${goal.toLocaleString('da-DK')} ${currency}**`, inline: false },
      ],
      footer: 'Tak for din støtte! 💚',
      buttons: [{ label: linkLabel, url: link, emoji: '' }],
    };
    onGenerate(embed);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Target className="h-4 w-4 mr-1" /> Donation Goal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generér Donation Goal Embed</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Hvad skal købes</Label>
            <Input value={item} onChange={e => setItem(e.target.value)} placeholder="fx Ny VPS Server" />
          </div>
          <div>
            <Label>Beskrivelse</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <Label>Mål</Label>
              <Input type="number" value={goal} onChange={e => setGoal(Number(e.target.value))} />
            </div>
            <div className="col-span-1">
              <Label>Indsamlet</Label>
              <Input type="number" value={current} onChange={e => setCurrent(Number(e.target.value))} />
            </div>
            <div className="col-span-1">
              <Label>Valuta</Label>
              <Input value={currency} onChange={e => setCurrency(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Donations link</Label>
            <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Knap tekst</Label>
              <Input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} />
            </div>
            <div>
              <Label>Farve</Label>
              <div className="flex gap-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-12 rounded border border-input cursor-pointer" />
                <Input value={color} onChange={e => setColor(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-2 text-xs font-mono">
            {buildProgressBar(current, goal)} {goal > 0 ? Math.round((current / goal) * 100) : 0}%
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annullér</Button>
          <Button onClick={handleGenerate}>Generér</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
