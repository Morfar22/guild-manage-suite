// Server-only OpenAI helper shared by all self-hosted AI routes.

export const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
export const DEFAULT_OPENAI_MODEL = 'gpt-6-luna';

type RuntimeEnv = Record<string, unknown>;

function readStringBinding(env: RuntimeEnv | undefined, key: string): string | undefined {
  const value = env?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export type RuntimeEnvSource =
  | 'cloudflare:workers'
  | 'process.env'
  | 'nitro-global'
  | 'server-bridge'
  | 'missing';

export function readRuntimeEnvWithSource(key: string): { value?: string; source: RuntimeEnvSource } {
  const processValue =
    typeof process !== 'undefined' && process.env
      ? process.env[key]
      : undefined;

  if (typeof processValue === 'string' && processValue.trim()) {
    return { value: processValue.trim(), source: 'process.env' };
  }

  const globals = globalThis as typeof globalThis & {
    __env__?: RuntimeEnv;
    __GUILD_MANAGE_RUNTIME_ENV__?: RuntimeEnv;
  };

  const nitroBinding = readStringBinding(globals.__env__, key);
  if (nitroBinding) return { value: nitroBinding, source: 'nitro-global' };

  const bridgedBinding = readStringBinding(
    globals.__GUILD_MANAGE_RUNTIME_ENV__,
    key,
  );
  if (bridgedBinding) return { value: bridgedBinding, source: 'server-bridge' };

  return { source: 'missing' };
}

export async function readRuntimeEnvWithSourceAsync(
  key: string,
): Promise<{ value?: string; source: RuntimeEnvSource }> {
  const syncValue = readRuntimeEnvWithSource(key);
  if (syncValue.value) return syncValue;

  try {
    // Runtime-only import. @vite-ignore prevents the client/SSR build from
    // trying to resolve the Cloudflare virtual module.
    const moduleName = 'cloudflare:workers';
    const mod = await import(/* @vite-ignore */ moduleName);
    const cloudflareValue = readStringBinding(
      mod?.env as RuntimeEnv | undefined,
      key,
    );
    if (cloudflareValue) {
      return { value: cloudflareValue, source: 'cloudflare:workers' };
    }
  } catch {
    // Not running inside Cloudflare Workers, continue as unconfigured.
  }

  return { source: 'missing' };
}

function readRuntimeEnv(key: string): string | undefined {
  return readRuntimeEnvWithSource(key).value;
}

/* legacy body removed */
export function getOpenAIModel(): string {
  const configured = readRuntimeEnv('OPENAI_MODEL');
  // Automatically migrate the old model id used by the first OpenAI migration.
  if (!configured || configured === 'gpt-5.6-luna') {
    return DEFAULT_OPENAI_MODEL;
  }
  return configured;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(readRuntimeEnv('OPENAI_API_KEY'));
}

export class OpenAIRequestError extends Error {
  status: number;
  code: string;
  upstreamStatus?: number;
  requestId?: string;

  constructor(
    message: string,
    status: number,
    code: string,
    upstreamStatus?: number,
    requestId?: string,
  ) {
    super(message);
    this.name = 'OpenAIRequestError';
    this.status = status;
    this.code = code;
    this.upstreamStatus = upstreamStatus;
    this.requestId = requestId;
  }
}

function mapOpenAIError(
  status: number,
  payload: any,
  requestId?: string,
): OpenAIRequestError {
  const upstreamCode = String(
    payload?.error?.code || payload?.error?.type || '',
  ).toLowerCase();

  if (status === 401) {
    return new OpenAIRequestError(
      'OpenAI API-nøglen er ugyldig eller ikke aktiv.',
      502,
      'openai_invalid_key',
      status,
      requestId,
    );
  }

  if (status === 403) {
    return new OpenAIRequestError(
      'OpenAI-projektet har ikke adgang til den valgte model.',
      502,
      'openai_model_access_denied',
      status,
      requestId,
    );
  }

  if (status === 429) {
    const quotaExceeded =
      upstreamCode.includes('quota') ||
      upstreamCode.includes('billing') ||
      String(payload?.error?.message || '').toLowerCase().includes('quota');

    return new OpenAIRequestError(
      quotaExceeded
        ? 'OpenAI-projektet har ikke tilgængelig quota eller billing.'
        : 'OpenAI er rate limited. Prøv igen om lidt.',
      429,
      quotaExceeded ? 'openai_quota_exceeded' : 'openai_rate_limited',
      status,
      requestId,
    );
  }

  if (status === 400) {
    return new OpenAIRequestError(
      'OpenAI afviste AI-requesten. Kontroller model og request-format.',
      502,
      'openai_bad_request',
      status,
      requestId,
    );
  }

  return new OpenAIRequestError(
    'OpenAI kunne ikke behandle requesten.',
    502,
    'openai_upstream_error',
    status,
    requestId,
  );
}

export async function openAIChatCompletion(
  payload: Record<string, unknown>,
  options: { timeoutMs?: number } = {},
): Promise<any> {
  const apiKey = (await readRuntimeEnvWithSourceAsync('OPENAI_API_KEY')).value;
  if (!apiKey) {
    throw new OpenAIRequestError(
      'OPENAI_API_KEY mangler i serverens runtime bindings.',
      500,
      'openai_not_configured',
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 30_000,
  );

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getOpenAIModel(),
        reasoning_effort: 'none',
        store: false,
        ...payload,
      }),
      signal: controller.signal,
    });

    const requestId = response.headers.get('x-request-id') || undefined;
    const raw = await response.text();

    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = raw ? { raw } : null;
    }

    if (!response.ok) {
      const mapped = mapOpenAIError(response.status, parsed, requestId);
      console.error('[OpenAI]', {
        code: mapped.code,
        upstreamStatus: response.status,
        requestId,
      });
      throw mapped;
    }

    return parsed;
  } catch (error) {
    if (error instanceof OpenAIRequestError) throw error;

    if (
      error instanceof DOMException &&
      error.name === 'AbortError'
    ) {
      throw new OpenAIRequestError(
        'OpenAI-requesten fik timeout.',
        504,
        'openai_timeout',
      );
    }

    throw new OpenAIRequestError(
      error instanceof Error ? error.message : 'OpenAI netværksfejl',
      502,
      'openai_network_error',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function openAIErrorResponse(
  error: unknown,
  corsHeaders: Record<string, string> = {},
): Response | null {
  if (!(error instanceof OpenAIRequestError)) return null;

  return new Response(
    JSON.stringify({
      error: error.message,
      code: error.code,
      ...(error.requestId ? { request_id: error.requestId } : {}),
    }),
    {
      status: error.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}
