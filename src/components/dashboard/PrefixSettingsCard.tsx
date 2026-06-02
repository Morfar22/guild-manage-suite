import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Terminal, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PrefixSettingsCardProps {
  guildId?: string;
}

export function PrefixSettingsCard({ guildId }: PrefixSettingsCardProps) {
  const [prefix, setPrefix] = useState('!');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!guildId) return;

    const fetchPrefix = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from('guild_bot_settings')
          .select('command_prefix')
          .eq('guild_id', guildId)
          .maybeSingle();

        if (data?.command_prefix) {
          setPrefix(data.command_prefix);
        }
      } catch {
        // Default prefix
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrefix();
  }, [guildId]);

  const handleSave = async () => {
    if (!guildId || !prefix.trim()) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('guild_bot_settings')
        .upsert(
          { guild_id: guildId, command_prefix: prefix.trim() },
          { onConflict: 'guild_id' }
        );

      if (error) throw error;
      toast.success(`Prefix ændret til "${prefix.trim()}"`);
    } catch (err) {
      console.error('Error saving prefix:', err);
      toast.error('Kunne ikke gemme prefix');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Kommando Prefix</CardTitle>
            <CardDescription>
              Alle slash-kommandoer virker også som prefix-kommandoer (f.eks. {prefix}ban, {prefix}help)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="space-y-2 flex-1 max-w-xs">
            <Label htmlFor="prefix">Prefix</Label>
            <Input
              id="prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="!"
              maxLength={5}
              disabled={isLoading}
              className="font-mono text-lg"
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving || !prefix.trim()}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Gem
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Eksempler: <code className="bg-muted px-1 rounded">{prefix}ban @bruger</code> · <code className="bg-muted px-1 rounded">{prefix}help</code> · <code className="bg-muted px-1 rounded">{prefix}balance</code>
        </p>
      </CardContent>
    </Card>
  );
}
