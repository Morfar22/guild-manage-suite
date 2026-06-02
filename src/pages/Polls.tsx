import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2, BarChart3, StopCircle, Vote } from 'lucide-react';
import { usePolls, PollOption } from '@/hooks/usePolls';
import { useAuth } from '@/contexts/AuthContext';
import { ChannelSelect } from '@/components/ui/channel-select';
import { format } from 'date-fns';
import { da } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Polls() {
  const { activePolls, endedPolls, isLoading, createPoll, endPoll, deletePoll } = usePolls();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [question, setQuestion] = useState('');
  const [optionLabels, setOptionLabels] = useState(['', '']);
  const [endsAt, setEndsAt] = useState('');
  const [allowMultiple, setAllowMultiple] = useState(false);

  const addOption = () => {
    if (optionLabels.length < 10) setOptionLabels([...optionLabels, '']);
  };

  const removeOption = (index: number) => {
    if (optionLabels.length > 2) setOptionLabels(optionLabels.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    setOptionLabels(optionLabels.map((o, i) => (i === index ? value : o)));
  };

  const handleCreate = () => {
    if (!channelId || !question || optionLabels.some((o) => !o.trim())) return;

    const options: PollOption[] = optionLabels.map((label) => ({
      label: label.trim(),
      votes: 0,
      voters: [],
    }));

    createPoll.mutate(
      {
        channel_id: channelId,
        question,
        options,
        created_by: user?.id ?? 'unknown',
        created_by_name: user?.email?.split('@')[0],
        ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
        allow_multiple: allowMultiple,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setChannelId('');
          setQuestion('');
          setOptionLabels(['', '']);
          setEndsAt('');
          setAllowMultiple(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Afstemninger</h1>
          <p className="text-muted-foreground">Opret og administrer afstemninger i din server</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ny Afstemning
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Opret Afstemning</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kanal</Label>
                <ChannelSelect value={channelId} onValueChange={setChannelId} placeholder="Vælg kanal..." />
              </div>

              <div className="space-y-2">
                <Label>Spørgsmål</Label>
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Hvad skal der stemmes om?" />
              </div>

              <div className="space-y-2">
                <Label>Muligheder</Label>
                {optionLabels.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Mulighed ${i + 1}`}
                    />
                    {optionLabels.length > 2 && (
                      <Button variant="ghost" size="icon" onClick={() => removeOption(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                {optionLabels.length < 10 && (
                  <Button variant="outline" size="sm" onClick={addOption}>
                    <Plus className="mr-2 h-3 w-3" />
                    Tilføj mulighed
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Slutter (valgfrit)</Label>
                <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>

              <div className="flex items-center justify-between">
                <Label>Tillad flere stemmer</Label>
                <Switch checked={allowMultiple} onCheckedChange={setAllowMultiple} />
              </div>

              <Button
                onClick={handleCreate}
                disabled={!channelId || !question || optionLabels.some((o) => !o.trim()) || createPoll.isPending}
                className="w-full"
              >
                {createPoll.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Vote className="mr-2 h-4 w-4" />}
                Opret Afstemning
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Polls */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Aktive ({activePolls.length})</h2>
        {activePolls.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Vote className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">Ingen aktive afstemninger</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {activePolls.map((poll) => {
              const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
              const chartData = poll.options.map((o) => ({ name: o.label, votes: o.votes }));

              return (
                <Card key={poll.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{poll.question}</CardTitle>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => endPoll.mutate(poll.id)}>
                          <StopCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deletePoll.mutate(poll.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>
                      {totalVotes} stemmer • Oprettet af {poll.votes?.created_by_name ?? 'Ukendt'}
                      {poll.ends_at && ` • Slutter ${format(new Date(poll.ends_at), 'PPP HH:mm', { locale: da })}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {totalVotes > 0 ? (
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={chartData} layout="vertical">
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="votes" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">Ingen stemmer endnu</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Ended Polls */}
      {endedPolls.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Afsluttede ({endedPolls.length})</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {endedPolls.slice(0, 10).map((poll) => {
              const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
              const winner = [...poll.options].sort((a, b) => b.votes - a.votes)[0];

              return (
                <Card key={poll.id} className="opacity-70">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{poll.question}</CardTitle>
                      <Button variant="ghost" size="icon" onClick={() => deletePoll.mutate(poll.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <CardDescription>{totalVotes} stemmer</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Vinder: {winner?.label ?? '–'}</Badge>
                      <span className="text-sm text-muted-foreground">({winner?.votes ?? 0} stemmer)</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
