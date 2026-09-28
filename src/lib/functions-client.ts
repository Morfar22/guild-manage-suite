import { supabase } from '@/integrations/supabase/client';

/**
 * Drop-in replacement for `supabase.functions.invoke()` that calls the
 * migrated TanStack server routes under `/api/public/*` instead of
 * Supabase Edge Functions.
 */
export async function invokeFunction<T = any>(
  name: string,
  options?: { body?: unknown; headers?: Record<string, string>; method?: string },
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    };

    if (!headers['Authorization']) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/public/${name}`, {
      method: options?.method ?? 'POST',
      headers,
      ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });

    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      const message =
        (parsed && typeof parsed === 'object' && (parsed.error || parsed.message)) ||
        `Function ${name} failed with status ${res.status}`;
      const error = new Error(String(message)) as Error & {
        code?: string;
        status?: number;
        requestId?: string;
      };
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.code === 'string') error.code = parsed.code;
        if (typeof parsed.request_id === 'string') error.requestId = parsed.request_id;
      }
      error.status = res.status;
      return { data: null, error };
    }

    return { data: parsed as T, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
