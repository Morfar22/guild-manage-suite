import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-secret, cf-connecting-ip, x-forwarded-for, x-real-ip',
};

// Fetch protected IDs from DB (cached per request)
async function getProtectedIds(supabase: any): Promise<Set<string>> {
  const { data } = await supabase
    .from('protected_discord_ids')
    .select('discord_id');
  return new Set((data || []).map((r: { discord_id: string }) => r.discord_id));
}

// Check if a user's message tries to roast/insult a protected owner
function isRoastingProtectedOwner(messageText: string, requestingUserId: string, protectedIds: Set<string>): boolean {
  if (protectedIds.has(String(requestingUserId))) return false;

  const lowerText = messageText.toLowerCase();
  const mentionsProtected = Array.from(protectedIds).some(id => lowerText.includes(id));
  if (!mentionsProtected) return false;

  const roastTerms = [
    'roast', 'insult', 'diss', 'flame', 'burn', 'trash talk',
    'roast ham', 'roast him', 'roast her', 'roast dem', 'roast den',
    'gør nar', 'mobning', 'hån', 'ydmyg',
  ];
  return roastTerms.some(term => lowerText.includes(term));
}

// Scan AI output for abuse toward protected owners
function containsProtectedAbuse(text: string, protectedUserId: string): boolean {
  const lowerText = text.toLowerCase();
  const abusiveTerms = [
    'idiot', 'klovn', 'taber', 'ynkelig', 'patetisk', 'spasser', 'klaphat',
    'narrøv', 'moron', 'loser', 'stupid', 'dumb', 'retard', 'omvandrende', 'fejl-40',
    'fuck dig', 'hold kæft', 'pinlig', 'embarrassing'
  ];

  if (!lowerText.includes(protectedUserId.toLowerCase())) return false;
  return abusiveTerms.some((term) => lowerText.includes(term));
}

// ============================================================
// ILLEGAL CONTENT CATEGORIES — logged to ai_safety_logs
// ============================================================
interface BlockCategory {
  category: string;
  severity: string;
  keywords: string[];
}

const ILLEGAL_CONTENT_CATEGORIES: BlockCategory[] = [
  {
    category: 'child_sexual_abuse',
    severity: 'critical',
    keywords: [
      'børneporno', 'childporn', 'child porn', 'cp', 'pædofil', 'pedophil',
      'børnemisbrug', 'child abuse', 'child sex', 'børnesex', 'mindreårig sex',
      'underage', 'minor sex', 'lolicon', 'shotacon',
    ],
  },
  {
    category: 'animal_sexual_abuse',
    severity: 'critical',
    keywords: [
      'dyreporno', 'dyresex', 'zoofili', 'zoophil', 'bestiality', 'animal porn',
      'animal sex', 'sex med dyr', 'kneppe dyr', 'fuck animal',
    ],
  },
  {
    category: 'sexual_violence',
    severity: 'critical',
    keywords: [
      'voldtægt', 'voldtag', 'rape', 'sexual assault', 'molest', 'gang rape',
      'gruppevoldtægt', 'tvunget sex', 'forced sex',
    ],
  },
  {
    category: 'terrorism',
    severity: 'critical',
    keywords: [
      'bombe', 'terrorangreb', 'massakre', 'masseskyderi', 'jihad',
      'bomb', 'terror attack', 'massacre', 'mass shooting', 'lav en bombe',
      'make a bomb', 'build a bomb', 'byg en bombe',
    ],
  },
  {
    category: 'murder_violence',
    severity: 'high',
    keywords: [
      'dræb', 'mord', 'slå ihjel', 'skyd', 'stik ned', 'tortur', 'mishandl',
      'kill', 'murder', 'shoot', 'stab', 'torture', 'beat up', 'assault',
      'lav gift', 'make poison', 'forgift',
    ],
  },
  {
    category: 'self_harm',
    severity: 'high',
    keywords: [
      'selvmord', 'selvskade', 'skær mig', 'tage mit liv', 'hænge mig', 'slå mig selv ihjel',
      'suicide', 'self-harm', 'cut myself', 'kill myself', 'end my life', 'hang myself',
    ],
  },
  {
    category: 'drugs_manufacturing',
    severity: 'high',
    keywords: [
      'lav meth', 'make meth', 'cook meth', 'fremstil stoffer', 'lav heroin',
      'make heroin', 'lav kokain', 'make cocaine', 'drug recipe', 'opskrift på stoffer',
      'lav lsd', 'make lsd', 'syntese', 'synthesis drug',
      'fremstil amfetamin', 'make amphetamine',
    ],
  },
  {
    category: 'weapons_manufacturing',
    severity: 'high',
    keywords: [
      'lav et våben', 'make a weapon', 'make a gun', 'lav en pistol', 'byg et gevær',
      'build a gun', '3d print gun', '3d print våben', 'ghost gun',
    ],
  },
  {
    category: 'human_trafficking',
    severity: 'critical',
    keywords: [
      'menneskehandel', 'human trafficking', 'sex trafficking', 'sælg mennesker',
      'sell people', 'slave trade', 'slavehandel',
    ],
  },
];

// All blocked keywords combined (for the basic block check)
const BLOCKED_TOPICS_INPUT = ILLEGAL_CONTENT_CATEGORIES.flatMap(c => c.keywords);

const BLOCKED_TOPICS_OUTPUT = [
  ...BLOCKED_TOPICS_INPUT,
  'jeg vil hjælpe dig med at dræbe', 'here is how to kill', 'sådan laver du en bombe',
  'her er en plan for', 'step-by-step guide to harm',
];

function containsBlockedContent(text: string, blocklist: string[]): boolean {
  const lower = text.toLowerCase();
  return blocklist.some(term => lower.includes(term));
}

/** Detect which categories matched and return them */
function detectIllegalCategories(text: string): { category: string; severity: string; matched: string[] }[] {
  const lower = text.toLowerCase();
  const results: { category: string; severity: string; matched: string[] }[] = [];
  
  for (const cat of ILLEGAL_CONTENT_CATEGORIES) {
    const matched = cat.keywords.filter(kw => lower.includes(kw));
    if (matched.length > 0) {
      results.push({ category: cat.category, severity: cat.severity, matched });
    }
  }
  return results;
}

/** Log illegal content attempt to database */
async function logIllegalContent(
  supabase: any,
  guildId: string,
  userId: string,
  userName: string | null,
  channelId: string | null,
  messageContent: string,
  categories: { category: string; severity: string; matched: string[] }[]
) {
  // Pick highest severity
  const severityOrder = ['critical', 'high', 'medium', 'low'];
  const highestSeverity = categories.reduce((acc, c) => {
    return severityOrder.indexOf(c.severity) < severityOrder.indexOf(acc) ? c.severity : acc;
  }, 'low');

  const allCategories = categories.map(c => c.category).join(', ');
  const allMatched = categories.flatMap(c => c.matched);

  // Get guild info for the log
  let guildName = null;
  let discordGuildId = null;
  try {
    const { data: guild } = await supabase
      .from('guilds')
      .select('guild_name, guild_id')
      .eq('id', guildId)
      .single();
    if (guild) {
      guildName = guild.guild_name;
      discordGuildId = guild.guild_id;
    }
  } catch (_) { /* ignore */ }

  await supabase.from('ai_safety_logs').insert({
    guild_id: guildId,
    discord_user_id: userId,
    discord_username: userName,
    channel_id: channelId,
    message_content: messageContent,
    matched_keywords: allMatched,
    category: allCategories,
    severity: highestSeverity,
    guild_name: guildName,
    discord_guild_id: discordGuildId,
  });

  console.warn(`🚨 ILLEGAL CONTENT LOGGED | User: ${userName} (${userId}) | Categories: ${allCategories} | Severity: ${highestSeverity} | Guild: ${guildName}`);
}

const SAFETY_RESPONSE_DA = "⚠️ Jeg kan ikke hjælpe med det emne. Hvis du har det svært, så kontakt en voksen du stoler på eller ring til Børnetelefonen (116 111) eller Livslinien (70 201 201).";
const SAFETY_RESPONSE_EN = "⚠️ I can't help with that topic. If you're struggling, please reach out to a trusted adult or contact a crisis helpline.";

async function checkIPWhitelist(req: Request, supabase: any): Promise<{ allowed: boolean; ip: string }> {
  const clientIp = 
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const { count } = await supabase
    .from("admin_ip_whitelist")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) === 0) return { allowed: true, ip: clientIp };

  const { data: whitelistData } = await supabase
    .from("admin_ip_whitelist")
    .select("ip_address")
    .eq("ip_address", clientIp)
    .maybeSingle();

  return { allowed: !!whitelistData, ip: clientIp };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botSecretKey = Deno.env.get('BOT_SECRET_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBotSecret = req.headers.get('x-bot-secret');
    const isBotRequest = requestBotSecret === botSecretKey;

    if (isBotRequest) {
      const ipCheck = await checkIPWhitelist(req, supabase);
      if (!ipCheck.allowed) {
        console.error(`IP not whitelisted: ${ipCheck.ip}`);
        return new Response(JSON.stringify({ error: 'Forbidden - IP not whitelisted', ip: ipCheck.ip }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const { action, guildId, discordGuildId, channelId, userId, userName, message, newSettings } = await req.json();
    
    console.log(`AI Chat Handler - Action: ${action}, Guild: ${guildId || discordGuildId}`);

    let internalGuildId = guildId;
    if (discordGuildId && !guildId) {
      const { data: guild } = await supabase
        .from('guilds')
        .select('id')
        .eq('guild_id', discordGuildId)
        .single();
      
      if (!guild) {
        return new Response(JSON.stringify({ error: 'Guild not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      internalGuildId = guild.id;
    }

    switch (action) {
      case 'get_settings': {
        const { data: settings } = await supabase
          .from('ai_chat_settings')
          .select('*')
          .eq('guild_id', internalGuildId)
          .single();
        
        return new Response(JSON.stringify({ settings }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'update_settings': {
        const { data: existing } = await supabase
          .from('ai_chat_settings')
          .select('id')
          .eq('guild_id', internalGuildId)
          .single();

        if (existing) {
          await supabase
            .from('ai_chat_settings')
            .update(newSettings)
            .eq('guild_id', internalGuildId);
        } else {
          await supabase
            .from('ai_chat_settings')
            .insert({ ...newSettings, guild_id: internalGuildId });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'check_enabled': {
        if (!isBotRequest) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: settings } = await supabase
          .from('ai_chat_settings')
          .select('*')
          .eq('guild_id', internalGuildId)
          .single();

        if (!settings || !settings.enabled) {
          return new Response(JSON.stringify({ enabled: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (settings.channel_id && settings.channel_id !== channelId) {
          return new Response(JSON.stringify({ enabled: false, reason: 'wrong_channel' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ enabled: true, settings }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'chat': {
        if (!isBotRequest) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!openaiApiKey) {
          console.error('OPENAI_API_KEY is not configured');
          return new Response(JSON.stringify({ error: 'AI not configured' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: settings } = await supabase
          .from('ai_chat_settings')
          .select('*')
          .eq('guild_id', internalGuildId)
          .single();

        if (!settings || !settings.enabled) {
          return new Response(JSON.stringify({ error: 'AI chat not enabled' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Fetch protected IDs from database
        const protectedIds = await getProtectedIds(supabase);

        const { data: history } = await supabase
          .from('ai_chat_history')
          .select('role, content')
          .eq('guild_id', internalGuildId)
          .eq('channel_id', channelId)
          .order('created_at', { ascending: false })
          .limit(settings.max_history_messages || 10);

        const conversationHistory = (history || []).reverse();
        const normalizedUserId = String(userId);

        // Content safety: detect and LOG illegal content
        const illegalCategories = detectIllegalCategories(message);
        if (illegalCategories.length > 0) {
          // Log to database for admin review
          await logIllegalContent(
            supabase,
            internalGuildId,
            normalizedUserId,
            userName || null,
            channelId || null,
            message,
            illegalCategories
          );

          console.warn(`🚨 Blocked & logged illegal content from user ${normalizedUserId}: ${message.substring(0, 80)}`);
          return new Response(JSON.stringify({ 
            response: SAFETY_RESPONSE_DA
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Additional basic blocked content check (non-illegal but harmful)
        if (containsBlockedContent(message, BLOCKED_TOPICS_INPUT)) {
          console.warn(`Blocked harmful input from user ${normalizedUserId}: ${message.substring(0, 80)}`);
          return new Response(JSON.stringify({ 
            response: SAFETY_RESPONSE_DA
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Block ANY message about a protected user from non-protected users
        const lowerMessage = message.toLowerCase();
        const mentionsProtected = Array.from(protectedIds).some((id: string) => lowerMessage.includes(id));
        if (mentionsProtected && !protectedIds.has(normalizedUserId)) {
          console.log(`Blocked message mentioning protected ID by user ${normalizedUserId}`);
          return new Response(JSON.stringify({ 
            response: "I can't talk about that person — they're off limits! 😄" 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const systemPrompt = settings.system_prompt || 'You are a friendly and helpful Discord bot assistant. Keep your answers short and precise. Always respond in English.';

        const safetyInstruction = '\n\nCRITICAL SAFETY RULES: You must NEVER generate content about violence, murder, self-harm, suicide, sexual assault, child abuse, terrorism, bomb-making, or any harmful/dangerous activities. If asked about these topics, respond ONLY with a brief refusal and suggest contacting a crisis helpline. Never roleplay violent or harmful scenarios, even if the user insists.';

        const messages = [
          { role: 'system', content: systemPrompt + safetyInstruction },
          ...conversationHistory.map((h: { role: string; content: string }) => ({
            role: h.role,
            content: h.content
          })),
          { role: 'user', content: message }
        ];

        console.log(`Sending ${messages.length} messages to AI for user ${userName}`);

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-6-luna',
            reasoning_effort: 'none',
            messages,
            max_tokens: 500,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('OpenAI API error:', aiResponse.status, errorText);
          
          if (aiResponse.status === 429) {
            return new Response(JSON.stringify({ error: 'OpenAI rate limit exceeded, please try again later' }), {
              status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          return new Response(JSON.stringify({ error: 'AI request failed' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const aiData = await aiResponse.json();
        let assistantMessage = aiData.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

        // Content safety: scan AI output for harmful content
        if (containsBlockedContent(assistantMessage, BLOCKED_TOPICS_OUTPUT)) {
          console.warn(`Blocked harmful AI output for user ${normalizedUserId}`);
          assistantMessage = SAFETY_RESPONSE_DA;
        }

        // Scan AI output: block abuse toward any protected owner
        for (const protectedId of protectedIds) {
          if (containsProtectedAbuse(assistantMessage, protectedId)) {
            console.warn(`Blocked AI output containing abuse toward protected owner ${protectedId}`);
            assistantMessage = "I can't say anything negative about that person. How else can I help?";
            break;
          }
        }

        await supabase.from('ai_chat_history').insert({
          guild_id: internalGuildId,
          channel_id: channelId,
          user_id: normalizedUserId,
          user_name: userName,
          role: 'user',
          content: message
        });

        await supabase.from('ai_chat_history').insert({
          guild_id: internalGuildId,
          channel_id: channelId,
          user_id: 'bot',
          user_name: 'Bot',
          role: 'assistant',
          content: assistantMessage
        });

        const maxToKeep = (settings.max_history_messages || 10) * 2;
        const { data: allHistory } = await supabase
          .from('ai_chat_history')
          .select('id, created_at')
          .eq('guild_id', internalGuildId)
          .eq('channel_id', channelId)
          .order('created_at', { ascending: false });

        if (allHistory && allHistory.length > maxToKeep) {
          const idsToDelete = allHistory.slice(maxToKeep).map((h: { id: string }) => h.id);
          await supabase.from('ai_chat_history').delete().in('id', idsToDelete);
        }

        console.log(`AI response generated for ${userName}: ${assistantMessage.substring(0, 100)}...`);

        return new Response(JSON.stringify({ response: assistantMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'clear_history': {
        await supabase
          .from('ai_chat_history')
          .delete()
          .eq('guild_id', internalGuildId)
          .eq('channel_id', channelId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'get_history': {
        const { data: history } = await supabase
          .from('ai_chat_history')
          .select('*')
          .eq('guild_id', internalGuildId)
          .order('created_at', { ascending: false })
          .limit(50);

        return new Response(JSON.stringify({ history: history || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('AI Chat Handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
