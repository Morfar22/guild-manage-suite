// @ts-nocheck
// Migrated from Supabase Edge Function `ai-polish-text` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { openAIChatCompletion, openAIErrorResponse } from '@/lib/server/openai'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

__serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(__env('SUPABASE_URL')!, __env('SUPABASE_ANON_KEY')!);
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { text, tone = 'professional', decision = 'neutral', context = '', language = 'da' } = await req.json();
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const langName = language === 'da' ? 'Danish' : 'English';
    const systemPrompt = `You polish short staff responses to applications. Rewrite the user's draft into a clear, ${tone}, well-structured message in ${langName}. The decision context is: ${decision}. Keep the original intent. Be concise (max ~120 words). Do NOT add greetings like "Hi {name}" unless present. Do NOT invent facts. Return ONLY the polished text, no quotes, no explanations.${context ? `\n\nApplication context:\n${context.slice(0, 2000)}` : ''}`;

    const json = await openAIChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      max_completion_tokens: 400,
    });

    const polished = json.choices?.[0]?.message?.content?.trim() || text;

    return new Response(JSON.stringify({ polished }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const aiError = openAIErrorResponse(e, corsHeaders);
    if (aiError) return aiError;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/ai-polish-text')({
  server: {
    handlers: {
      GET: __call,
      POST: __call,
      PUT: __call,
      PATCH: __call,
      DELETE: __call,
      OPTIONS: __call,
    },
  },
})
