// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import {
  getOpenAIModel,
  readRuntimeEnvWithSourceAsync,
} from '@/lib/server/openai'

const handler = async () => {
  const key = await readRuntimeEnvWithSourceAsync('OPENAI_API_KEY')
  const model = await readRuntimeEnvWithSourceAsync('OPENAI_MODEL')

  return new Response(JSON.stringify({
    ok: Boolean(key.value),
    openai_configured: Boolean(key.value),
    key_source: key.source,
    model: getOpenAIModel(),
    model_source: model.source,
  }), {
    status: key.value ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

export const Route = createFileRoute('/api/public/ai-health')({
  server: {
    handlers: {
      GET: handler,
      HEAD: handler,
    },
  },
})
