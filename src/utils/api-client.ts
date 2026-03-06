import { getConfig, hasLiveConfig } from './config'
import { CLI_VERSION, DEFAULT_API_URL } from './constants'

export interface ApiContext {
  baseUrl: string
  instanceId: string
  headers: Record<string, string>
}

export type ValidationErrorItem = { path: (string | number)[]; message: string; [k: string]: unknown }

export interface ApiError extends Error {
  statusCode?: number
  validationErrors?: ValidationErrorItem[]
}

const NO_CONFIG_MSG = 'No API key configured. Run: blindpay config set --api-key <key> --instance-id <id>'

export function resolveContext(): ApiContext {
  if (!hasLiveConfig())
    throw new Error(NO_CONFIG_MSG)

  const config = getConfig()
  const baseUrl = (config.base_url ?? DEFAULT_API_URL).replace(/\/$/, '')
  return {
    baseUrl,
    instanceId: config.instance_id!,
    headers: {
      'User-Agent': `blindpay-cli/${CLI_VERSION}`,
      'X-Blindpay-Client': 'cli',
      Authorization: `Bearer ${config.api_key!}`,
    },
  }
}

function buildUrl(ctx: ApiContext, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${ctx.baseUrl}${p}`
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
  const url = buildUrl(ctx, path)
  const res = await fetch(url, { headers: ctx.headers })
  if (!res.ok) {
    const body = await res.text()
    throw parseErrorResponse(res.status, res.statusText, body)
  }
  return res.json() as Promise<T>
}

export async function apiPost<T = unknown>(ctx: ApiContext, path: string, body?: object): Promise<T> {
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
