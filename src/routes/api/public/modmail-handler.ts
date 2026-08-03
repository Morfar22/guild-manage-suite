// @ts-nocheck
// Migrated from Supabase Edge Function `modmail-handler` to a TanStack server route.
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const __env = (k: string) => process.env[k]
let __handler: (req: Request) => Response | Promise<Response>
const __serve = (fn: any, _opts?: any) => { __handler = fn }


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bot-secret",
};

__serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate bot secret
    const botSecret = req.headers.get("x-bot-secret");
    const expectedSecret = __env("BOT_SECRET_KEY");

    if (!botSecret || botSecret !== expectedSecret) {
      console.error("[Modmail] Invalid or missing bot secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = __env("SUPABASE_URL")!;
    const supabaseServiceKey = __env("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[Modmail] Action: ${action}, Params:`, JSON.stringify(params));

    switch (action) {
      case "getGuildByDiscordId": {
        const { discordGuildId } = params;
        const { data, error } = await supabase
          .from("guilds")
          .select("id, guild_id, guild_name")
          .eq("guild_id", discordGuildId)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[Modmail] Error fetching guild:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "getModmailSettings": {
        const { guildDbId } = params;
        const { data, error } = await supabase
          .from("modmail_settings")
          .select("*")
          .eq("guild_id", guildDbId)
          .eq("enabled", true)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[Modmail] Error fetching settings:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "getOpenThread": {
        const { guildDbId, userId } = params;
        const { data, error } = await supabase
          .from("modmail_threads")
          .select("*")
          .eq("guild_id", guildDbId)
          .eq("user_id", userId)
          .eq("status", "open")
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[Modmail] Error fetching thread:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "createThread": {
        const { guildDbId, userId, userName, userAvatar, channelId } = params;
        const { data, error } = await supabase
          .from("modmail_threads")
          .insert({
            guild_id: guildDbId,
            user_id: userId,
            user_name: userName,
            user_avatar: userAvatar,
            channel_id: channelId,
            status: "open",
          })
          .select()
          .single();

        if (error) {
          console.error("[Modmail] Error creating thread:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "saveMessage": {
        const { threadId, authorType, authorId, authorName, content, attachments } = params;
        const { error } = await supabase.from("modmail_messages").insert({
          thread_id: threadId,
          author_type: authorType,
          author_id: authorId,
          author_name: authorName,
          content: content || "",
          attachments: attachments || [],
        });

        if (error) {
          console.error("[Modmail] Error saving message:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "getThreadByChannelId": {
        const { channelId } = params;
        const { data, error } = await supabase
          .from("modmail_threads")
          .select("*, guilds!inner(guild_id)")
          .eq("channel_id", channelId)
          .eq("status", "open")
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[Modmail] Error fetching thread by channel:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "getSettingsByGuildId": {
        const { guildDbId } = params;
        const { data, error } = await supabase
          .from("modmail_settings")
          .select("*")
          .eq("guild_id", guildDbId)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("[Modmail] Error fetching settings:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "closeThread": {
        const { channelId } = params;
        
        // First get the thread
        const { data: thread, error: threadError } = await supabase
          .from("modmail_threads")
          .select("*, guilds!inner(id)")
          .eq("channel_id", channelId)
          .eq("status", "open")
          .limit(1)
          .maybeSingle();

        if (threadError || !thread) {
          return new Response(JSON.stringify({ 
            error: threadError?.message || "Thread not found",
            thread: null 
          }), {
            status: threadError ? 500 : 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get close message from settings
        const { data: settings } = await supabase
          .from("modmail_settings")
          .select("close_message")
          .eq("guild_id", thread.guild_id)
          .limit(1)
          .maybeSingle();

        // Update thread status
        const { error: updateError } = await supabase
          .from("modmail_threads")
          .update({
            status: "closed",
            closed_at: new Date().toISOString(),
          })
          .eq("id", thread.id);

        if (updateError) {
          console.error("[Modmail] Error closing thread:", updateError);
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          thread, 
          closeMessage: settings?.close_message 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "claimThread": {
        const { channelId, claimedById, claimedByName } = params;

        // First get the thread
        const { data: thread, error: threadError } = await supabase
          .from("modmail_threads")
          .select("*")
          .eq("channel_id", channelId)
          .eq("status", "open")
          .limit(1)
          .maybeSingle();

        if (threadError || !thread) {
          return new Response(JSON.stringify({ 
            error: threadError?.message || "Thread not found" 
          }), {
            status: threadError ? 500 : 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (thread.claimed_by_id) {
          return new Response(JSON.stringify({ 
            error: "already_claimed",
            claimedByName: thread.claimed_by_name 
          }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update thread with claim info
        const { error: updateError } = await supabase
          .from("modmail_threads")
          .update({
            claimed_by_id: claimedById,
            claimed_by_name: claimedByName,
          })
          .eq("id", thread.id);

        if (updateError) {
          console.error("[Modmail] Error claiming thread:", updateError);
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("[Modmail] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


const __call = ({ request }: { request: Request }) => __handler(request)

export const Route = createFileRoute('/api/public/modmail-handler')({
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
