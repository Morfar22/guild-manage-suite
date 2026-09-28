// @ts-nocheck
// Migrated from Supabase Edge Function `ai-automod` to a TanStack server route.
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

    if (action === 'analyze') {
      const { message_content, guild_id, user_id, user_name, channel_id, settings } = data;
      if (!message_content || !guild_id) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const sensitivity = settings?.sensitivity || 70;
      const checks = [];
      if (settings?.check_toxicity !== false) checks.push('toxicity');
      if (settings?.check_spam !== false) checks.push('spam');
      if (settings?.check_nsfw !== false) checks.push('NSFW content');
      if (settings?.check_hate_speech !== false) checks.push('hate speech');

      const customInstructions = settings?.custom_instructions || '';

      const systemPrompt = `You are a Discord message content moderator AI. Analyze messages for: ${checks.join(', ')}.
Sensitivity level: ${sensitivity}/100 (higher = stricter).
${customInstructions ? `Additional instructions: ${customInstructions}` : ''}

Respond ONLY with a JSON object (no markdown):
{
  "flagged": true/false,
  "reason": "brief reason if flagged",
  "category": "toxicity|spam|nsfw|hate_speech|clean",
  "confidence": 0-100,
  "severity": "low|medium|high"
}

Flag the message if confidence exceeds ${sensitivity}%.`;

      const aiResult = await openAIChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this Discord message:\n"${message_content}"` },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'discord_moderation_result',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                flagged: { type: 'boolean' },
                reason: { type: 'string' },
                category: { type: 'string', enum: ['toxicity', 'spam', 'nsfw', 'hate_speech', 'clean'] },
                confidence: { type: 'integer', minimum: 0, maximum: 100 },
                severity: { type: 'string', enum: ['low', 'medium', 'high'] },
              },
              required: ['flagged', 'reason', 'category', 'confidence', 'severity'],
            },
          },
        },
      });

      let content = aiResult.choices?.[0]?.message?.content || '';
      // Strip markdown code fences if present
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let analysis;
      try {
        analysis = JSON.parse(content);
      } catch {
        analysis = { flagged: false, reason: 'Failed to parse AI response', category: 'clean', confidence: 0, severity: 'low' };
      }

      return new Response(JSON.stringify({ success: true, analysis }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('AI Automod error:', error);
    const aiError = openAIErrorResponse(error, corsHeaders);
    if (aiError) return aiError;
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/ai-automod')({
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
