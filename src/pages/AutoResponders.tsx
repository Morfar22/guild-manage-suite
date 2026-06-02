import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Loader2, Plus, Trash2, MessageSquare, Zap, Brain } from 'lucide-react';
import { useAutoResponders } from '@/hooks/useAutoResponders';

export default function AutoResponders() {
  const { responders, isLoading, createResponder, updateResponder, deleteResponder } = useAutoResponders();

  const [open, setOpen] = useState(false);
  const [triggerText, setTriggerText] = useState('');
  const [triggerType, setTriggerType] = useState('exact');
  const [responseContent, setResponseContent] = useState('');
  const [responseType, setResponseType] = useState('text');
  const [cooldown, setCooldown] = useState(5);
  const [useAi, setUseAi] = useState(false);
  const [aiInstructions, setAiInstructions] = useState('');

  const handleCreate = () => {
    if (!triggerText || !responseContent) return;

    createResponder.mutate(
      {
        trigger_text: triggerText,
        trigger_type: triggerType,
        response_content: responseContent,
        response_type: responseType,
        cooldown_seconds: cooldown,
        use_ai: useAi,
        ai_instructions: aiInstructions || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setTriggerText('');
          setTriggerType('exact');
          setResponseContent('');
          setResponseType('text');
          setCooldown(5);
          setUseAi(false);
          setAiInstructions('');
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
          <h1 className="text-3xl font-bold">Auto-Responders</h1>
          <p className="text-muted-foreground">
            Automatiske svar på specifikke triggers i chatten
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ny Auto-Responder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opret Auto-Responder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Trigger Tekst</Label>
                <Input
                  value={triggerText}
                  onChange={(e) => setTriggerText(e.target.value)}
                  placeholder="F.eks. !regler eller hej"
                />
              </div>

              <div className="space-y-2">
                <Label>Trigger Type</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Eksakt match</SelectItem>
                    <SelectItem value="contains">Indeholder</SelectItem>
                    <SelectItem value="startswith">Starter med</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Svar</Label>
                <Textarea
                  value={responseContent}
                  onChange={(e) => setResponseContent(e.target.value)}
                  placeholder="Skriv det automatiske svar..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Svar Type</Label>
                <Select value={responseType} onValueChange={setResponseType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Tekst</SelectItem>
                    <SelectItem value="embed">Embed</SelectItem>
                    <SelectItem value="reaction">Reaktion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cooldown (sekunder)</Label>
                <Input
                  type="number"
                  min={0}
                  value={cooldown}
                  onChange={(e) => setCooldown(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    AI-Drevet Svar
                  </Label>
                  <p className="text-xs text-muted-foreground">Brug AI til at generere kontekstuelle svar</p>
                </div>
                <Switch checked={useAi} onCheckedChange={setUseAi} />
              </div>

              {useAi && (
                <div className="space-y-2">
                  <Label>AI Instruktioner (valgfrit)</Label>
                  <Textarea
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder="F.eks. 'Svar altid venligt og henvis til #regler kanalen'"
                    rows={2}
                  />
                </div>
              )}

              <Button
                onClick={handleCreate}
                disabled={!triggerText || !responseContent || createResponder.isPending}
                className="w-full"
              >
                {createResponder.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="mr-2 h-4 w-4" />
                )}
                Opret Auto-Responder
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {responders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">Ingen auto-responders oprettet endnu</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {responders.map((responder) => (
            <Card key={responder.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-mono">{responder.trigger_text}</CardTitle>
                    <Badge variant="outline">{responder.trigger_type}</Badge>
                    {responder.use_ai && (
                      <Badge variant="secondary" className="gap-1">
                        <Brain className="h-3 w-3" />
                        AI
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={responder.enabled}
                      onCheckedChange={(enabled) =>
                        updateResponder.mutate({ id: responder.id, enabled })
                      }
                    />
                    <Button variant="ghost" size="icon" onClick={() => deleteResponder.mutate(responder.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  {responder.response_type} • {responder.cooldown_seconds}s cooldown
                  {responder.use_ai && ' • AI-drevet kontekstuel svar'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm line-clamp-3">{responder.response_content}</p>
                {responder.ai_instructions && (
                  <p className="text-xs text-muted-foreground mt-2 italic">AI: {responder.ai_instructions}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
