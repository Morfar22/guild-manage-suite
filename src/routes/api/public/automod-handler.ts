// @ts-nocheck
// Migrated from Supabase Edge Function `automod-handler` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k]
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bot-secret, cf-connecting-ip, x-forwarded-for, x-real-ip',
};

// Helper function to check if IP is whitelisted
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

interface AutomodRequest {
  guild_id: string;
  user_id: string;
  username: string;
  channel_id: string;
  message_content: string;
  mentions_count?: number;
  role_mentions_count?: number;
}

interface AutomodResponse {
  should_act: boolean;
  action?: string;
  action_duration_seconds?: number;
  rule_type?: string;
  reason?: string;
}

__serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify bot secret
    const botSecret = req.headers.get('x-bot-secret');
    const expectedSecret = __env('BOT_SECRET_KEY');
    
    if (!botSecret || botSecret !== expectedSecret) {
      console.error('Unauthorized: Invalid bot secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      __env('SUPABASE_URL')!,
      __env('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check IP whitelist
    const ipCheck = await checkIPWhitelist(req, supabase);
    if (!ipCheck.allowed) {
      console.error(`IP not whitelisted: ${ipCheck.ip}`);
      return new Response(JSON.stringify({ error: 'Forbidden - IP not whitelisted', ip: ipCheck.ip }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { 
      guild_id, 
      user_id, 
      username,
      channel_id, 
      message_content,
      mentions_count = 0,
      role_mentions_count = 0,
    } = await req.json() as AutomodRequest;

    if (!guild_id || !user_id || !channel_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get guild UUID
    const { data: guild, error: guildError } = await supabase
      .from('guilds')
      .select('id')
      .eq('guild_id', guild_id)
      .maybeSingle();

    if (guildError || !guild) {
      return new Response(JSON.stringify({ error: 'Guild not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all enabled automod rules for this guild
    const { data: rules, error: rulesError } = await supabase
      .from('automod_rules')
      .select('*')
      .eq('guild_id', guild.id)
      .eq('enabled', true);

    if (rulesError) throw rulesError;

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ should_act: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check each rule
    for (const rule of rules) {
      // Skip if channel is exempt
      if (rule.exempt_channels?.includes(channel_id)) continue;

      let violated = false;
      let reason = '';

      const config = rule.config || {};

      switch (rule.rule_type) {
        case 'words': {
          const words = (config.words as string[]) || [];
          const matchExact = config.match_exact as boolean || false;
          const lowerContent = message_content.toLowerCase();
          
          for (const word of words) {
            if (matchExact) {
              if (lowerContent.split(/\s+/).includes(word.toLowerCase())) {
                violated = true;
                reason = `Banned word: ${word}`;
                break;
              }
            } else {
              if (lowerContent.includes(word.toLowerCase())) {
                violated = true;
                reason = `Banned word: ${word}`;
                break;
              }
            }
          }
          break;
        }

        case 'links': {
          const blockAll = config.block_all as boolean || false;
          const blockedDomains = (config.blocked_domains as string[]) || [];
          const allowedDomains = (config.allowed_domains as string[]) || [];
          
          const urlRegex = /https?:\/\/([^\s/]+)/gi;
          const matches = message_content.matchAll(urlRegex);
          
          for (const match of matches) {
            const domain = match[1].toLowerCase();
            
            if (allowedDomains.some(d => domain.includes(d.toLowerCase()))) {
              continue;
            }
            
            if (blockAll || blockedDomains.some(d => domain.includes(d.toLowerCase()))) {
              violated = true;
              reason = `Blocked link: ${domain}`;
              break;
            }
          }
          break;
        }

        case 'invites': {
          const blockAllInvites = config.block_all as boolean ?? true;
          const allowedServers = (config.allowed_servers as string[]) || [];
          
          const inviteRegex = /discord(?:\.gg|app\.com\/invite|\.com\/invite)\/([a-zA-Z0-9-]+)/gi;
          const hasInvite = inviteRegex.test(message_content);
          
          if (hasInvite && blockAllInvites) {
            violated = true;
            reason = 'Discord invites not allowed';
          }
          break;
        }

        case 'mentions': {
          const maxMentions = (config.max_mentions as number) || 5;
          const maxRoleMentions = (config.max_role_mentions as number) || 3;
          
          if (mentions_count > maxMentions) {
            violated = true;
            reason = `Too many mentions: ${mentions_count}/${maxMentions}`;
          } else if (role_mentions_count > maxRoleMentions) {
            violated = true;
            reason = `Too many role mentions: ${role_mentions_count}/${maxRoleMentions}`;
          }
          break;
        }

        case 'caps': {
          const maxCapsPercent = (config.max_caps_percent as number) || 70;
          const minLength = (config.min_length as number) || 10;
          
          if (message_content.length >= minLength) {
            const capsCount = (message_content.match(/[A-Z]/g) || []).length;
            const letterCount = (message_content.match(/[a-zA-Z]/g) || []).length;
            
            if (letterCount > 0) {
              const capsPercent = (capsCount / letterCount) * 100;
              if (capsPercent > maxCapsPercent) {
                violated = true;
                reason = `Too much CAPS: ${capsPercent.toFixed(0)}%`;
              }
            }
          }
          break;
        }

        case 'ai_toxicity': {
          const sensitivity = (config.sensitivity as number) || 70;
          const LOVABLE_API_KEY = __env('LOVABLE_API_KEY');
          
          if (LOVABLE_API_KEY && message_content.length > 3) {
            try {
              const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-2.5-flash-lite',
                  messages: [
                    {
                      role: 'system',
                      content: `You are a content moderation AI. Analyze the following message for toxicity, hate speech, harassment, NSFW content, or spam. Respond ONLY with a JSON object: {"toxic": true/false, "score": 0-100, "reason": "brief reason"}. Score represents toxicity level (0=safe, 100=extremely toxic). Threshold is ${sensitivity}.`
                    },
                    { role: 'user', content: message_content }
                  ],
                }),
              });

              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                const content = aiData.choices?.[0]?.message?.content || '';
                
                try {
                  const jsonMatch = content.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    const result = JSON.parse(jsonMatch[0]);
                    if (result.toxic && result.score >= sensitivity) {
                      violated = true;
                      reason = `AI Toxicity (${result.score}%): ${result.reason || 'Toxic content detected'}`;
                    }
                  }
                } catch {
                  console.error('Failed to parse AI response:', content);
                }
              }
            } catch (aiError) {
              console.error('AI toxicity check error:', aiError);
            }
          }
          break;
        }
      }

      if (violated) {
        // Log the violation
        await supabase.from('automod_logs').insert({
          guild_id: guild.id,
          rule_type: rule.rule_type,
          user_id,
          user_name: username,
          channel_id,
          message_content: message_content.substring(0, 500),
          action_taken: rule.action,
        });

        console.log(`Automod triggered: ${rule.rule_type} - ${reason}`);

        const response: AutomodResponse = {
          should_act: true,
          action: rule.action,
          action_duration_seconds: rule.action_duration_seconds,
          rule_type: rule.rule_type,
          reason,
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ should_act: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Automod handler error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/automod-handler')({
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
