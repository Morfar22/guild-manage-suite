// @ts-nocheck
// Migrated from Supabase Edge Function `ai-auto-respond` to a TanStack server route.
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
    if (!botSecret || botSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { action, data } = await req.json();

    if (action === 'generate_response') {
      const { message_content, trigger_text, ai_instructions, response_content } = data;

      if (!message_content) {
        return new Response(JSON.stringify({ error: 'Missing message_content' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const systemPrompt = `You are a Discord auto-responder AI. Generate a helpful, contextual response based on the user's message.

Trigger context: "${trigger_text}"
Base response template: "${response_content}"
${ai_instructions ? `Special instructions: ${ai_instructions}` : ''}

Rules:
- Keep responses concise (under 300 characters for Discord)
- Be helpful and friendly
- Stay on topic based on the trigger context
- If the base response template is provided, use it as a guide but adapt to the specific message
- Respond in the same language as the user's message`;

      const aiResult = await openAIChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message_content },
        ],
        max_completion_tokens: 300,
      });

      const generatedResponse = aiResult.choices?.[0]?.message?.content || response_content;

      return new Response(JSON.stringify({ success: true, response: generatedResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('AI Auto-Respond error:', error);
    const aiError = openAIErrorResponse(error, corsHeaders);
    if (aiError) return aiError;
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/ai-auto-respond')({
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
