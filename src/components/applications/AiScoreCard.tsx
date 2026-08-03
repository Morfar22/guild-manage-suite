import { Sparkles, AlertTriangle, CheckCircle2, ThumbsDown, ThumbsUp, Bot } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/lib/functions-client';

interface AiScoreCardProps {
  submissionId: string;
  score: number | null;
  summary: string | null;
  flags: string[] | null;
  reasoning: string | null;
  aiGeneratedLikelihood?: number | null;
  aiGeneratedReasoning?: string | null;
  canRescreen?: boolean;
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-rose-400';
}

function scoreGradient(score: number) {
  if (score >= 80) return 'from-emerald-500/20 to-emerald-500/5';
  if (score >= 60) return 'from-amber-500/20 to-amber-500/5';
  if (score >= 40) return 'from-orange-500/20 to-orange-500/5';
  return 'from-rose-500/20 to-rose-500/5';
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-24 w-24 -rotate-90 transform" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} className="fill-none stroke-muted/40" strokeWidth="6" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          className={cn('fill-none transition-all duration-700', scoreColor(score))}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold tabular-nums', scoreColor(score))}>{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">AI Score</span>
      </div>
    </div>
  );
}

export function AiScoreCard({
  submissionId,
  score,
  summary,
  flags,
  reasoning,
  aiGeneratedLikelihood,
  aiGeneratedReasoning,
  canRescreen = true,
}: AiScoreCardProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const runScreen = async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeFunction('ai-screen-application', {
        body: { submission_id: submissionId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.skipped) {
        toast({ title: 'Sprunget over', description: data.reason });
      } else {
        toast({ title: 'AI-screening færdig', description: `Score: ${data?.result?.score}/100` });
      }
      qc.invalidateQueries({ queryKey: ['application-submission', submissionId] });
    } catch (e: any) {
      toast({ title: 'AI-screening fejlede', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (score == null) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Ingen AI-vurdering endnu</p>
              <p className="text-xs text-muted-foreground">Kør AI-screening for at få score + resumé</p>
            </div>
          </div>
          {canRescreen && (
            <Button size="sm" onClick={runScreen} disabled={loading}>
              <Sparkles className="mr-2 h-4 w-4" />
              {loading ? 'Analyserer…' : 'Kør screening'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden border-0 bg-gradient-to-br shadow-lg', scoreGradient(score))}>
      <CardContent className="p-5">
        <div className="flex items-start gap-5">
          <ScoreRing score={score} />
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold uppercase tracking-wide">AI-vurdering</span>
              </div>
              {canRescreen && (
                <Button variant="ghost" size="sm" onClick={runScreen} disabled={loading}>
                  {loading ? 'Analyserer…' : 'Kør igen'}
                </Button>
              )}
            </div>

            {summary && <p className="text-sm font-medium leading-snug">{summary}</p>}

            {flags && flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {flags.map((flag) => {
                  const positive = /fremragende|engageret|detaljeret|kvalitet/i.test(flag);
                  return (
                    <Badge
                      key={flag}
                      variant="outline"
                      className={cn(
                        'border-0 text-xs',
                        positive
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-rose-500/15 text-rose-300',
                      )}
                    >
                      {positive ? <ThumbsUp className="mr-1 h-3 w-3" /> : <AlertTriangle className="mr-1 h-3 w-3" />}
                      {flag.replace(/_/g, ' ')}
                    </Badge>
                  );
                })}
              </div>
            )}

            {reasoning && (
              <p className="text-xs text-muted-foreground/90 leading-relaxed border-l-2 border-primary/30 pl-3">
                {reasoning}
              </p>
            )}

            {aiGeneratedLikelihood != null && (
              <div className={cn(
                'mt-2 rounded-lg border p-3 space-y-1.5',
                aiGeneratedLikelihood >= 70
                  ? 'border-rose-500/30 bg-rose-500/10'
                  : aiGeneratedLikelihood >= 40
                  ? 'border-amber-500/30 bg-amber-500/10'
                  : 'border-emerald-500/30 bg-emerald-500/10',
              )}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bot className={cn(
                      'h-4 w-4',
                      aiGeneratedLikelihood >= 70 ? 'text-rose-400' : aiGeneratedLikelihood >= 40 ? 'text-amber-400' : 'text-emerald-400',
                    )} />
                    <span className="text-xs font-semibold uppercase tracking-wide">AI-detektion</span>
                  </div>
                  <span className={cn(
                    'text-sm font-bold tabular-nums',
                    aiGeneratedLikelihood >= 70 ? 'text-rose-400' : aiGeneratedLikelihood >= 40 ? 'text-amber-400' : 'text-emerald-400',
                  )}>
                    {aiGeneratedLikelihood}% AI
                  </span>
                </div>
                {aiGeneratedReasoning && (
                  <p className="text-xs text-muted-foreground/90 leading-relaxed">{aiGeneratedReasoning}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
