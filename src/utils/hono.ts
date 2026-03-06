import type { Context } from 'hono'

export function param(c: Context, name: string): string {
  return c.req.param(name) as string
}
