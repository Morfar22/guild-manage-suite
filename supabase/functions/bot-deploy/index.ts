// Admin-gated proxy to the VPS deploy-agent.
// Validates: caller has admin role, then forwards request to deploy-agent
// using DEPLOY_AGENT_URL + DEPLOY_AGENT_TOKEN. Token is NEVER exposed to client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DeployRequest {
  action: "status" | "logs" | "pull" | "restart" | "start" | "stop" | "deploy";
  lines?: number;
}

const ACTION_MAP: Record<DeployRequest["action"], { method: string; path: string }> = {
  status:  { method: "GET",  path: "/bot/status" },
  logs:    { method: "GET",  path: "/bot/logs" },
  pull:    { method: "POST", path: "/bot/pull" },
  restart: { method: "POST", path: "/bot/restart" },
  start:   { method: "POST", path: "/bot/start" },
  stop:    { method: "POST", path: "/bot/stop" },
  deploy:  { method: "POST", path: "/bot/deploy" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseAuthed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabaseAuthed.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    // 2. Admin check
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc(
      "has_role",
      { _user_id: userData.user.id, _role: "admin" }
    );
    if (roleError || !isAdmin) return json({ error: "Forbidden - admin only" }, 403);

    // 3. Parse + validate body
    const body: DeployRequest = await req.json().catch(() => ({}));
    const cfg = ACTION_MAP[body.action];
    if (!cfg) return json({ error: "Invalid action" }, 400);

    // 4. Read agent config
    const agentUrl = Deno.env.get("DEPLOY_AGENT_URL");
    const agentToken = Deno.env.get("DEPLOY_AGENT_TOKEN");
    if (!agentUrl || !agentToken) {
      return json({ error: "Deploy agent not configured" }, 500);
    }

    // 5. Build URL + forward
    let url = `${agentUrl.replace(/\/$/, "")}${cfg.path}`;
    if (body.action === "logs" && body.lines) {
      url += `?lines=${encodeURIComponent(String(body.lines))}`;
    }

    console.log(`[bot-deploy] ${userData.user.email} → ${body.action}`);

    const upstream = await fetch(url, {
      method: cfg.method,
      headers: {
        "Authorization": `Bearer ${agentToken}`,
        "Content-Type": "application/json",
      },
    });

    const text = await upstream.text();
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

    const commandOk = upstream.ok && isSuccessfulAgentPayload(body.action, payload);
    return json({ ok: commandOk, status: upstream.status, data: payload }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[bot-deploy] error:", message);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isSuccessfulAgentPayload(action: DeployRequest["action"], payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return true;
  const data = payload as Record<string, unknown>;

  if (typeof data.ok === "boolean") return data.ok;

  if (action === "deploy") {
    const steps = [data.pull, data.install, data.restart].filter(Boolean) as Record<string, unknown>[];
    if (steps.length > 0) return steps.every((step) => step.ok === true);
  }

  return true;
}
