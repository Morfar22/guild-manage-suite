// @ts-nocheck
// Migrated from Supabase Edge Function `ai-ticket-summary` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { openAIChatCompletion, openAIErrorResponse } from '@/lib/server/openai'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-secret',
};

__serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const botSecret = req.headers.get('x-bot-secret');
    const expectedSecret = __env('BOT_SECRET_KEY');

    // Allow both bot secret and authenticated dashboard users
    let authenticated = false;
    if (botSecret && botSecret === expectedSecret) {
      authenticated = true;
    }

    if (!authenticated) {
      // Try JWT auth for dashboard
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        const supabase = createClient(
          __env('SUPABASE_URL')!,
          __env('SUPABASE_ANON_KEY')!
        );
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) authenticated = true;
      }
    }

    if (!authenticated) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { action, data } = await req.json();

    const supabase = createClient(
      __env('SUPABASE_URL')!,
      __env('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (action === 'summarize') {
      const { ticket_id } = data;
      if (!ticket_id) {
        return new Response(JSON.stringify({ error: 'Missing ticket_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Fetch ticket and messages
      const { data: ticket } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticket_id)
        .single();

      if (!ticket) {
        return new Response(JSON.stringify({ error: 'Ticket not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: messages } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticket_id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (!messages || messages.length === 0) {
        return new Response(JSON.stringify({ error: 'No messages to summarize' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const transcript = messages.map(m => `${m.author_name || m.author_id}: ${m.content}`).join('\n');

      const aiResult = await openAIChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You are a support ticket summarizer. Create a concise summary of the ticket conversation.
Include: main issue, key actions taken, resolution (if any), and outcome.
Keep it under 200 words. Be factual and clear. Respond in the same language as the conversation.`
          },
          {
            role: 'user',
            content: `Ticket subject: ${ticket.subject || 'No subject'}\nCreated by: ${ticket.creator_name || 'Unknown'}\nStatus: ${ticket.status}\n\nConversation:\n${transcript}`
          },
        ],
        max_completion_tokens: 600,
      });

      const summary = aiResult.choices?.[0]?.message?.content || 'Could not generate summary';

      // Save summary to ticket
      await supabase
        .from('tickets')
        .update({ ai_summary: summary })
        .eq('id', ticket_id);

      return new Response(JSON.stringify({ success: true, summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('AI Ticket Summary error:', error);
    const aiError = openAIErrorResponse(error, corsHeaders);
    if (aiError) return aiError;
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/ai-ticket-summary')({
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
