import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CloneProgress } from '@/components/server-clone/CloneProgressDialog';

const initialResults = {
  channelsDeleted: 0,
  rolesDeleted: 0,
  rolesCreated: 0,
  categoriesCreated: 0,
  channelsCreated: 0,
  errors: [] as string[],
};

export function useCloneWithProgress() {
  const [isCloning, setIsCloning] = useState(false);
  const [progress, setProgress] = useState<CloneProgress | null>(null);

  const cloneServer = useCallback(async ({
    sourceGuildId,
    targetGuildId,
    templateId,
  }: {
    sourceGuildId?: string;
    targetGuildId: string;
    templateId?: string;
  }) => {
    setIsCloning(true);
    setProgress({
      phase: 'preparing',
      current: 0,
      total: 0,
      results: { ...initialResults },
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${projectUrl}/functions/v1/server-clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'clone-stream',
          sourceGuildId,
          targetGuildId,
          templateId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Clone failed');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'progress') {
                setProgress(data.payload);
              } else if (data.type === 'complete') {
                setProgress({
                  phase: 'complete',
                  current: 1,
                  total: 1,
                  results: data.payload.results,
                });
                toast.success('Kloning fuldført!');
              } else if (data.type === 'error') {
                const errorMessage = data.payload.error || 'Ukendt fejl';
                setProgress(prev => prev ? {
                  ...prev,
                  phase: 'error',
                  currentItem: errorMessage,
                  results: {
                    ...prev.results,
                    errors: [errorMessage, ...prev.results.errors.filter((error) => error !== errorMessage)],
                  },
                } : {
                  phase: 'error',
                  current: 0,
                  total: 0,
                  currentItem: errorMessage,
                  results: {
                    ...initialResults,
                    errors: [errorMessage],
                  },
                });
                toast.error(errorMessage);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Kloning fejlede: ${message}`);
      setProgress(prev => prev ? {
        ...prev,
        phase: 'error',
        currentItem: message,
        results: {
          ...prev.results,
          errors: [message, ...prev.results.errors.filter((error) => error !== message)],
        },
      } : {
        phase: 'error',
        current: 0,
        total: 0,
        currentItem: message,
        results: {
          ...initialResults,
          errors: [message],
        },
      });
    } finally {
      // Keep dialog open for 2 seconds after completion
      setTimeout(() => {
        setIsCloning(false);
        setProgress(null);
      }, 2000);
    }
  }, []);

  return {
    cloneServer,
    isCloning,
    progress,
  };
}
