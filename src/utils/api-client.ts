import process from 'node:process'
import { getConfig, hasLiveConfig } from './config'
import { CLI_VERSION, DEFAULT_API_URL, MOCK_INSTANCE_ID } from './constants'

const DEFAULT_PORT = 4242

export interface ApiContext {
  baseUrl: string
  instanceId: string
  headers: Record<string, string>
  mode: 'mock' | 'live'
}

const NO_CONFIG_MSG = 'No API key configured. Run blindpay config set --api-key <key> --instance-id <id> or use --mock for local development.'

/**
 * Resolve API context: mock (localhost + fixed instance) or live (config api_key + instance_id).
 * Default is live API; pass mock: true to use the local mock server.
 */
export function resolveContext(options: { port?: number, mock?: boolean }): ApiContext {
  const useMock = options.mock === true
  const port = options.port ?? (Number.isNaN(Number(process.env.BLINDPAY_PORT)) ? DEFAULT_PORT : Number(process.env.BLINDPAY_PORT))

  const baseHeaders: Record<string, string> = {
    'User-Agent': `blindpay-cli/${CLI_VERSION}`,
    'X-Blindpay-Client': 'cli',
  }

  if (useMock) {
    const baseUrl = `http://localhost:${port}`
    return {
      baseUrl,
      instanceId: MOCK_INSTANCE_ID,
      headers: baseHeaders,
      mode: 'mock',
    }
  }

  if (!hasLiveConfig())
    throw new Error(NO_CONFIG_MSG)

  const config = getConfig()
  const baseUrl = (config.base_url ?? DEFAULT_API_URL).replace(/\/$/, '')
  const authHeaders: Record<string, string> = {
    ...baseHeaders,
    Authorization: `Bearer ${config.api_key!}`,
  }
  return {
    baseUrl,
    instanceId: config.instance_id!,
    headers: authHeaders,
    mode: 'live',
  }
}

const NOT_RUNNING_MSG = 'Mock server is not running. Start it with: blindpay mock'

export async function ensureServer(baseUrl: string): Promise<void> {
  try {
    const res = await fetch(baseUrl)
    if (!res.ok) throw new Error(String(res.status))
  }
  catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('fetch')) {
      const e = new Error(NOT_RUNNING_MSG) as Error & { code?: string }
      e.code = 'ECONNREFUSED'
      throw e
    }
    throw err
  }
}

function buildUrl(ctx: ApiContext, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${ctx.baseUrl}${p}`
}

/** Zod-style: { path: string[], message: string } (and optional code, expected, received). */
export type ValidationErrorItem = { path: (string | number)[]; message: string; [k: string]: unknown }

export interface ApiError extends Error {
  statusCode?: number
  validationErrors?: ValidationErrorItem[]
}

function parseErrorResponse(status: number, statusText: string, text: string): ApiError {
  let msg = `Request failed: ${status} ${statusText}`
  let validationErrors: ValidationErrorItem[] | undefined
  try {
    const j = JSON.parse(text) as { message?: string; errors?: ValidationErrorItem[] }
    if (j.message)
      msg = j.message
    if (Array.isArray(j.errors) && j.errors.length > 0)
      validationErrors = j.errors
  }
  catch {
    if (text)
      msg = text.slice(0, 200)
  }
  const err = new Error(msg) as ApiError
  err.statusCode = status
  if (validationErrors)
    err.validationErrors = validationErrors
  return err
}

export async function apiGet<T = unknown>(ctx: ApiContext, path: string): Promise<T> {
  if (ctx.mode === 'mock')
    await ensureServer(ctx.baseUrl)
  const url = buildUrl(ctx, path)
  const res = await fetch(url, { headers: ctx.headers })
  if (!res.ok) {
    const body = await res.text()
    throw parseErrorResponse(res.status, res.statusText, body)
  }
  return res.json() as Promise<T>
}

export async function apiPost<T = unknown>(ctx: ApiContext, path: string, body?: object): Promise<T> {
  if (ctx.mode === 'mock')
    await ensureServer(ctx.baseUrl)
  const url = buildUrl(ctx, path)
  const headers = { ...ctx.headers, 'Content-Type': 'application/json' }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw parseErrorResponse(res.status, res.statusText, text)
  }
  return res.json() as Promise<T>
}

export async function apiPut<T = unknown>(ctx: ApiContext, path: string, body: object): Promise<T> {
  if (ctx.mode === 'mock')
    await ensureServer(ctx.baseUrl)
  const url = buildUrl(ctx, path)
  const headers = { ...ctx.headers, 'Content-Type': 'application/json' }
  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw parseErrorResponse(res.status, res.statusText, text)
  }
  return res.json() as Promise<T>
}

export async function apiDelete<T = unknown>(ctx: ApiContext, path: string): Promise<T> {
  if (ctx.mode === 'mock')
    await ensureServer(ctx.baseUrl)
  const url = buildUrl(ctx, path)
  const res = await fetch(url, { method: 'DELETE', headers: ctx.headers })
  if (!res.ok) {
    const text = await res.text()
    throw parseErrorResponse(res.status, res.statusText, text)
  }
  const contentType = res.headers.get('content-type')
  if (contentType?.includes('application/json')) return res.json() as Promise<T>
  return undefined as T
}

/** Legacy: get base URL for mock-only commands (trigger, advance, status). */
export function getBaseUrl(port?: number): string {
  const envPort = Number.parseInt(process.env.BLINDPAY_PORT ?? '', 10)
  const p = port ?? (Number.isNaN(envPort) ? DEFAULT_PORT : envPort)
  return `http://localhost:${p}`
}

export { NOT_RUNNING_MSG }
