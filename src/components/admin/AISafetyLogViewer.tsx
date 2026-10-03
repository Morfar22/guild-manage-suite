import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Shield, Mail, Eye, EyeOff, Check } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { da } from 'date-fns/locale';

interface SafetyLog {
  id: string;
  guild_id: string;
  discord_user_id: string;
  discord_username: string | null;
  channel_id: string | null;
  message_content: string;
  matched_keywords: string[];
  category: string;
  severity: string;
  reviewed: boolean;
  admin_notes: string | null;
  guild_name: string | null;
  discord_guild_id: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  child_sexual_abuse: '🔴 Børneporno / Seksuel misbrug af børn',
  animal_sexual_abuse: '🔴 Dyreporno / Zoofili',
  sexual_violence: '🔴 Seksuel vold / Voldtægt',
  terrorism: '🔴 Terrorisme',
  murder_violence: '🟠 Mord / Grov vold',
  self_harm: '🟠 Selvskade / Selvmord',
  drugs_manufacturing: '🟠 Narkofremstilling',
  weapons_manufacturing: '🟠 Våbenfremstilling',
  human_trafficking: '🔴 Menneskehandel',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-500 text-white',
};

export function AISafetyLogViewer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterReviewed, setFilterReviewed] = useState<string>('unreviewed');
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['ai-safety-logs', filterCategory, filterReviewed],
    queryFn: async () => {
      let query = supabase
        .from('ai_safety_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filterCategory !== 'all') {
        query = query.ilike('category', `%${filterCategory}%`);
      }
      if (filterReviewed === 'unreviewed') {
        query = query.eq('reviewed', false);
      } else if (filterReviewed === 'reviewed') {
        query = query.eq('reviewed', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SafetyLog[];
    },
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const markReviewed = useMutation({
    mutationFn: async ({ ids, notes }: { ids: string[]; notes?: string }) => {
      const update: Record<string, any> = { reviewed: true };
      if (notes) update.admin_notes = notes;
      const { error } = await supabase
        .from('ai_safety_logs')
        .update(update)
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-safety-logs'] });
      setSelectedLogs(new Set());
      toast({ title: 'Markeret som gennemgået' });
    },
  });

  const updateNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('ai_safety_logs')
        .update({ admin_notes: notes })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-safety-logs'] });
      toast({ title: 'Notat gemt' });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!logs) return;
    if (selectedLogs.size === logs.length) {
      setSelectedLogs(new Set());
    } else {
      setSelectedLogs(new Set(logs.map(l => l.id)));
    }
  };

  const generatePoliceEmail = () => {
    const selectedEntries = logs?.filter(l => selectedLogs.has(l.id)) || [];
    if (selectedEntries.length === 0) {
      toast({ title: 'Vælg mindst én log', variant: 'destructive' });
      return;
    }

    const now = format(new Date(), 'dd-MM-yyyy HH:mm', { locale: da });

    let email = `Til Dansk Politi / NC3 (Nationalt Cyber Crime Center)\n`;
    email += `Dato: ${now}\n\n`;
    email += `Emne: Anmeldelse af ulovligt indhold forsøgt kommunikeret via Discord AI-chat\n\n`;
    email += `Kære rette vedkommende,\n\n`;
    email += `Hermed anmeldes følgende ${selectedEntries.length} hændelse(r) hvor brugere har forsøgt at kommunikere potentielt ulovligt indhold via en AI-chatfunktion på Discord.\n\n`;
    email += `Systemet har automatisk blokeret indholdet og logget følgende detaljer:\n\n`;
    email += `${'='.repeat(60)}\n\n`;

    selectedEntries.forEach((entry, i) => {
      const cats = entry.category.split(', ').map(c => CATEGORY_LABELS[c] || c).join(', ');
      email += `--- Hændelse ${i + 1} ---\n`;
      email += `Tidspunkt: ${format(new Date(entry.created_at), 'dd-MM-yyyy HH:mm:ss', { locale: da })}\n`;
      email += `Discord Bruger ID: ${entry.discord_user_id}\n`;
      email += `Discord Brugernavn: ${entry.discord_username || 'Ukendt'}\n`;
      email += `Discord Server: ${entry.guild_name || 'Ukendt'} (ID: ${entry.discord_guild_id || 'Ukendt'})\n`;
      email += `Kanal ID: ${entry.channel_id || 'Ukendt'}\n`;
      email += `Kategori: ${cats}\n`;
      email += `Alvorlighedsgrad: ${entry.severity.toUpperCase()}\n`;
      email += `Matchede nøgleord: ${entry.matched_keywords?.join(', ') || 'Ingen'}\n`;
      email += `Besked indhold:\n"${entry.message_content}"\n`;
      if (entry.admin_notes) email += `Admin noter: ${entry.admin_notes}\n`;
      email += `\n`;
    });

    email += `${'='.repeat(60)}\n\n`;
    email += `Ovenstående data er automatisk indsamlet af et AI-sikkerheds-overvågningssystem.\n`;
    email += `Discord bruger-ID'er kan bruges til at identificere brugerne via Discord Inc.\n\n`;
    email += `Med venlig hilsen,\n[Dit navn]\n[Kontaktoplysninger]`;

    return email;
  };

  const handleCopyEmail = () => {
    const email = generatePoliceEmail();
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopied(true);
    toast({ title: 'Email kopieret til udklipsholder' });
    setTimeout(() => setCopied(false), 3000);
  };

  const criticalCount = logs?.filter(l => l.severity === 'critical' && !l.reviewed).length || 0;
  const unreviewedCount = logs?.filter(l => !l.reviewed).length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              AI Sikkerhedslog — Ulovligt Indhold
            </CardTitle>
            <CardDescription>
              Logger registrerede forsøg på ulovligt indhold via AI-chatten på tværs af alle servere
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge className="bg-red-600 text-white animate-pulse">
                {criticalCount} kritiske
              </Badge>
            )}
            {unreviewedCount > 0 && (
              <Badge variant="outline">{unreviewedCount} ugennemgåede</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters & Actions */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrer kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle kategorier</SelectItem>
              <SelectItem value="child_sexual_abuse">Børneporno</SelectItem>
              <SelectItem value="animal_sexual_abuse">Dyreporno</SelectItem>
              <SelectItem value="sexual_violence">Seksuel vold</SelectItem>
              <SelectItem value="terrorism">Terrorisme</SelectItem>
              <SelectItem value="murder_violence">Mord / Vold</SelectItem>
              <SelectItem value="self_harm">Selvskade</SelectItem>
              <SelectItem value="drugs_manufacturing">Narkofremstilling</SelectItem>
              <SelectItem value="weapons_manufacturing">Våbenfremstilling</SelectItem>
              <SelectItem value="human_trafficking">Menneskehandel</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterReviewed} onValueChange={setFilterReviewed}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="unreviewed">Ugennemgåede</SelectItem>
              <SelectItem value="reviewed">Gennemgåede</SelectItem>
            </SelectContent>
          </Select>

          {selectedLogs.size > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => markReviewed.mutate({ ids: Array.from(selectedLogs) })}
                disabled={markReviewed.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Markér {selectedLogs.size} som gennemgået
              </Button>
              <Button
                size="sm"
                onClick={handleCopyEmail}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                {copied ? 'Kopieret!' : `Generér politianmeldelse (${selectedLogs.size})`}
              </Button>
            </>
          )}
        </div>

        {/* Log entries */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Ingen hændelser fundet</p>
            <p className="text-sm">Ingen forsøg på ulovligt indhold er logget endnu</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                checked={selectedLogs.size === logs.length && logs.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-xs text-muted-foreground">Vælg alle ({logs.length})</span>
            </div>

            {logs.map(log => {
              const isExpanded = expandedLogs.has(log.id);
              const categories = log.category.split(', ');

              return (
                <div
                  key={log.id}
                  className={`border rounded-lg p-3 space-y-2 ${
                    log.severity === 'critical' ? 'border-red-500/50 bg-red-500/5' :
                    log.severity === 'high' ? 'border-orange-500/30 bg-orange-500/5' :
                    'border-border'
                  } ${log.reviewed ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={selectedLogs.has(log.id)}
                      onCheckedChange={() => toggleSelect(log.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={SEVERITY_COLORS[log.severity] || 'bg-gray-500'}>
                          {log.severity.toUpperCase()}
                        </Badge>
                        {categories.map(cat => (
                          <Badge key={cat} variant="outline" className="text-[10px]">
                            {CATEGORY_LABELS[cat] || cat}
                          </Badge>
                        ))}
                        {log.reviewed && (
                          <Badge variant="secondary" className="text-[10px]">
                            ✓ Gennemgået
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span title="Discord bruger">{log.discord_username || log.discord_user_id}</span>
                        <span>•</span>
                        <span title="Server">{log.guild_name || 'Ukendt server'}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: da })}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleExpand(log.id)}
                      className="shrink-0"
                    >
                      {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="ml-8 space-y-3 text-sm border-t pt-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Besked indhold:</p>
                        <p className="bg-muted/50 p-2 rounded text-xs font-mono break-all">
                          {log.message_content}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Discord User ID: </span>
                          <span className="font-mono">{log.discord_user_id}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Kanal ID: </span>
                          <span className="font-mono">{log.channel_id || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Server ID: </span>
                          <span className="font-mono">{log.discord_guild_id || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tidspunkt: </span>
                          <span>{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: da })}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Matchede nøgleord:</p>
                        <div className="flex flex-wrap gap-1">
                          {log.matched_keywords?.map((kw, i) => (
                            <Badge key={i} variant="destructive" className="text-[10px]">{kw}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Admin noter:</p>
                        <Textarea
                          value={editingNotes[log.id] ?? log.admin_notes ?? ''}
                          onChange={e => setEditingNotes(prev => ({ ...prev, [log.id]: e.target.value }))}
                          placeholder="Tilføj noter om denne hændelse..."
                          className="text-xs h-16"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-1"
                          onClick={() => updateNotes.mutate({
                            id: log.id,
                            notes: editingNotes[log.id] ?? log.admin_notes ?? ''
                          })}
                          disabled={updateNotes.isPending}
                        >
                          Gem noter
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
