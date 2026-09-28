// @ts-nocheck
// Migrated from Supabase Edge Function `ai-screen-application` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { openAIChatCompletion, openAIErrorResponse } from '@/lib/server/openai'

const __env = (k: string) => process.env[k] ?? (k === 'SUPABASE_ANON_KEY' ? process.env['SUPABASE_PUBLISHABLE_KEY'] : undefined)
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }

// AI Screening for Applications
// Bruger OpenAI API til at score og opsummere ansøgninger.
// Hvis form har auto-approve/deny tærskler, kører action automatisk.


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface ScreenRequest {
  submission_id: string;
}

interface AiResult {
  score: number;
  summary: string;
  flags: string[];
  reasoning: string;
  recommendation: 'approve' | 'deny' | 'review';
  ai_generated_likelihood: number;
  ai_generated_reasoning: string;
}

__serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = __env('SUPABASE_URL')!;
    const SERVICE_KEY = __env('SUPABASE_SERVICE_ROLE_KEY')!;

    const { submission_id } = (await req.json()) as ScreenRequest;
    if (!submission_id) return json({ error: 'submission_id required' }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Hent submission + form
    const { data: sub, error: subErr } = await supabase
      .from('application_submissions')
      .select('*, form:application_forms(*)')
      .eq('id', submission_id)
      .maybeSingle();

    if (subErr || !sub) return json({ error: 'Submission not found' }, 404);

    const form = sub.form as any;
    if (!form?.ai_screening_enabled) {
      return json({ skipped: true, reason: 'AI screening disabled on form' });
    }

    // Tjek premium
    const { data: hasPro } = await supabase.rpc('guild_has_applications_pro', {
      _guild_id: sub.guild_id,
    });
    if (!hasPro) {
      return json({ skipped: true, reason: 'Premium required for AI screening' });
    }

    // Byg prompt
    const customPrompt = form.ai_screening_prompt?.trim() ||
      'Du er en streng men retfærdig moderator der vurderer ansøgninger. Vær kritisk overfor svar der virker copy/pastede, korte eller mangelfulde.';

    const answersText = (sub.answers as any[])
      .map((a: any) => `Q: ${a.question || a.label}\nA: ${a.answer || a.value || '(tomt)'}`)
      .join('\n\n');

    const systemPrompt = `${customPrompt}

Du skal returnere en struktureret vurdering via tool call. 
- score: 0-100 (0=ubrugelig, 100=perfekt)
- summary: 1-2 sætninger på dansk
- flags: array af korte tags som "kort_svar", "uoverensstemmelse", "manglende_detaljer", "fremragende", "engageret", "muligt_ai_genereret"
- reasoning: 2-4 sætninger der forklarer scoren
- recommendation: "approve" hvis fremragende, "deny" hvis ubrugelig, "review" ellers
- ai_generated_likelihood: 0-100 sandsynlighed for at svarene er skrevet af AI (ChatGPT, Gemini osv). Kig efter: generisk/poleret sprog, manglende personlige detaljer, perfekt grammatik uden naturlige fejl, lister/struktur der ligner LLM output, klichéfyldte vendinger, mangel på autentisk stemme.
- ai_generated_reasoning: 1-2 sætninger på dansk der forklarer hvorfor du tror/ikke tror det er AI-genereret`;

    const userPrompt = `Form: ${form.name}\nBeskrivelse: ${form.description || '(ingen)'}\n\nAnsøgers svar:\n${answersText}`;

    const aiJson = await openAIChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'submit_evaluation',
            description: 'Returnér din vurdering af ansøgningen',
            strict: true,
            parameters: {
              type: 'object',
              additionalProperties: false,
              properties: {
                score: { type: 'integer', minimum: 0, maximum: 100 },
                summary: { type: 'string' },
                flags: { type: 'array', items: { type: 'string' } },
                reasoning: { type: 'string' },
                recommendation: { type: 'string', enum: ['approve', 'deny', 'review'] },
                ai_generated_likelihood: { type: 'integer', minimum: 0, maximum: 100 },
                ai_generated_reasoning: { type: 'string' },
              },
              required: ['score', 'summary', 'flags', 'reasoning', 'recommendation', 'ai_generated_likelihood', 'ai_generated_reasoning'],
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'submit_evaluation' } },
      max_completion_tokens: 1200,
    });


    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: 'No tool call in AI response' }, 500);

    const result: AiResult = JSON.parse(toolCall.function.arguments);

    // Gem AI-felter
    await supabase
      .from('application_submissions')
      .update({
        ai_score: result.score,
        ai_summary: result.summary,
        ai_flags: result.flags,
        ai_reasoning: result.reasoning,
        ai_generated_likelihood: result.ai_generated_likelihood,
        ai_generated_reasoning: result.ai_generated_reasoning,
      })
      .eq('id', submission_id);

    // Audit log
    await supabase.from('application_audit_log').insert({
      guild_id: sub.guild_id,
      submission_id,
      form_id: sub.form_id,
      actor_type: 'ai',
      actor_name: 'AI Screening',
      action: 'ai_screened',
      payload: result,
    });

    // Auto-action
    let autoAction: string | null = null;
    if (form.ai_auto_approve_threshold != null && result.score >= form.ai_auto_approve_threshold) {
      autoAction = 'approved';
    } else if (form.ai_auto_deny_threshold != null && result.score <= form.ai_auto_deny_threshold) {
      autoAction = 'denied';
    }

    if (autoAction) {
      await supabase
        .from('application_submissions')
        .update({
          status: autoAction === 'approved' ? 'approved' : 'denied',
          reviewer_name: 'AI Auto-Review',
          reviewer_notes: `Auto-${autoAction} based on AI score ${result.score}: ${result.summary}`,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submission_id);

      await supabase.from('application_audit_log').insert({
        guild_id: sub.guild_id,
        submission_id,
        form_id: sub.form_id,
        actor_type: 'ai',
        actor_name: 'AI Auto-Review',
        action: `auto_${autoAction}`,
        payload: { score: result.score, threshold_used: autoAction === 'approved' ? form.ai_auto_approve_threshold : form.ai_auto_deny_threshold },
      });
    }

    return json({ success: true, result, auto_action: autoAction });
  } catch (err) {
    console.error('ai-screen-application error:', err);
    const aiError = openAIErrorResponse(err, corsHeaders);
    if (aiError) return aiError;
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/ai-screen-application')({
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
