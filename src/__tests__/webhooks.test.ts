import { describe, test, expect, mock } from 'bun:test'
import { createHmac } from 'crypto'
import { setForwardUrls, getForwardUrls, dispatchWebhook } from '../webhooks/dispatcher'
import { WEBHOOK_SIGNING_SECRET } from '../utils/constants'

describe('webhooks', () => {
  test('getForwardUrls / setForwardUrls', () => {
    setForwardUrls([])
    expect(getForwardUrls()).toEqual([])
    setForwardUrls(['http://localhost:3000/hooks'])
    expect(getForwardUrls()).toEqual(['http://localhost:3000/hooks'])
    setForwardUrls([])
  })

  test('Svix signature format: whsec_<base64> key, toSign = msgId.timestamp.body', () => {
    const secret = WEBHOOK_SIGNING_SECRET
    expect(secret).toMatch(/^whsec_[A-Za-z0-9+/=]+$/)
    const parts = secret.split('_')
    const key = Buffer.from(parts[1], 'base64')
    expect(key.length).toBeGreaterThan(0)

    const msgId = 'msg_123'
    const timestamp = '1700000000'
    const body = '{"webhook_event":"payout.complete","id":"pa_1"}'
    const toSign = `${msgId}.${timestamp}.${body}`
    const sig = createHmac('sha256', key).update(toSign).digest('base64')
    const header = `v1,${sig}`
    expect(header).toMatch(/^v1,[A-Za-z0-9+/=]+$/)
  })

  test('dispatchWebhook sends payload with Svix headers when forwardUrls set', async () => {
    const fetchMock = mock((url: string, init: RequestInit) => {
      expect(init?.method).toBe('POST')
      expect(init?.headers).toBeDefined()
      const headers = init?.headers as Record<string, string>
      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['Svix-Id']).toMatch(/^msg_/)
      expect(headers['Svix-Timestamp']).toMatch(/^\d+$/)
      expect(headers['Svix-Signature']).toMatch(/^v1,[A-Za-z0-9+/=]+$/)
      const body = JSON.parse(init?.body as string)
      expect(body.webhook_event).toBe('payout.complete')
      expect(body.id).toBe('pa_test123')
      return Promise.resolve(new Response('OK', { status: 200 }))
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as any

    setForwardUrls(['http://localhost:9999/hooks'])
    await dispatchWebhook('payout.complete', { id: 'pa_test123' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    setForwardUrls([])
    globalThis.fetch = originalFetch
  })

  test('dispatchWebhook does nothing when forwardUrls empty', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('OK', { status: 200 })))
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as any
    setForwardUrls([])
    await dispatchWebhook('payout.complete', { id: 'pa_1' })
    expect(fetchMock).toHaveBeenCalledTimes(0)
    globalThis.fetch = originalFetch
  })
})
