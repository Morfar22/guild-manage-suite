import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const botSecret = req.headers.get('x-bot-secret');
    const expectedSecret = Deno.env.get('BOT_SECRET_KEY');
    if (!botSecret || botSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { action, data } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

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

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5.6-luna',
          reasoning_effort: 'none',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analyze this Discord message:\n"${message_content}"` },
          ],
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: 'OpenAI rate limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        throw new Error(`OpenAI API error: ${status}`);
      }

      const aiResult = await response.json();
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
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
