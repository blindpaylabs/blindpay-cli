import { describe, test, expect, beforeEach } from 'bun:test'
import { createMockServer } from '../server/index'
import { store } from '../store/index'
import { setLifecycleOptions } from '../lifecycle/index'
import { MOCK_INSTANCE_ID } from '../utils/constants'

setLifecycleOptions({ manual: true, delay: 100 })

describe('server', () => {
  const instanceId = MOCK_INSTANCE_ID

  test('GET / returns health', async () => {
    const app = createMockServer()
    const res = await app.request('/')
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.name).toBe('Blindpay Mock API')
    expect(json.status).toBe('running')
  })

  test('GET /v1/instances returns list', async () => {
    const app = createMockServer()
    const res = await app.request('/v1/instances')
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.some((i: { id: string }) => i.id === instanceId)).toBe(true)
  })

  test('GET /v1/instances/:id returns instance', async () => {
    const app = createMockServer()
    const res = await app.request(`/v1/instances/${instanceId}`)
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.id).toBe(instanceId)
    expect(json.name).toBeDefined()
  })

  test('GET /v1/instances/:id/receivers returns receivers', async () => {
    const app = createMockServer()
    const res = await app.request(`/v1/instances/${instanceId}/receivers`)
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('POST /v1/instances/:id/receivers creates receiver', async () => {
    const app = createMockServer()
    const res = await app.request(`/v1/instances/${instanceId}/receivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', type: 'individual' }),
    })
    expect(res.status).toBe(201)
    const json = await res.json() as any
    expect(json.id).toMatch(/^re_/)
    expect(json.email).toBe('new@test.com')
  })

  test('GET /v1/instances/:id/receivers/:receiverId/bank-accounts returns bank accounts', async () => {
    const app = createMockServer()
    const receivers = store.listByInstance(store.receivers, instanceId)
    const receiverId = receivers[0]?.id
    if (!receiverId)
      return
    const res = await app.request(`/v1/instances/${instanceId}/receivers/${receiverId}/bank-accounts`)
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(Array.isArray(json.data)).toBe(true)
  })

  test('POST quote and payout flow', async () => {
    const app = createMockServer()
    const receivers = store.listByInstance(store.receivers, instanceId)
    const receiverId = receivers[0]?.id
    const accounts = store.listByInstanceAndReceiver(store.bankAccounts, instanceId, receiverId!)
    const bankAccountId = accounts[0]?.id
    if (!receiverId || !bankAccountId)
      return

    const quoteRes = await app.request(`/v1/instances/${instanceId}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank_account_id: bankAccountId, amount: 1000 }),
    })
    expect(quoteRes.status).toBe(201)
    const quote = await quoteRes.json() as any
    expect(quote.id).toMatch(/^qu_/)

    const payoutRes = await app.request(`/v1/instances/${instanceId}/payouts/evm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quote_id: quote.id,
        sender_wallet_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      }),
    })
    expect(payoutRes.status).toBe(201)
    const payout = await payoutRes.json() as any
    expect(payout.id).toMatch(/^pa_/)
    expect(payout.status).toBe('processing')
  })

  test('GET /v1/e/payouts/:id returns payout', async () => {
    const app = createMockServer()
    const payouts = store.listByInstance(store.payouts, instanceId)
    if (payouts.length === 0)
      return
    const id = payouts[0].id
    const res = await app.request(`/v1/e/payouts/${id}`)
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.id).toBe(id)
  })

  test('GET /v1/e/payouts/nonexistent returns 404', async () => {
    const app = createMockServer()
    const res = await app.request('/v1/e/payouts/pa_nonexistent')
    expect(res.status).toBe(404)
  })

  test('removed routes return 404', async () => {
    const app = createMockServer()
    const whoami = await app.request('/v1/whoami')
    expect(whoami.status).toBe(404)
    const billing = await app.request(`/v1/instances/${instanceId}/billing/invoices`)
    expect(billing.status).toBe(404)
    const onboarding = await app.request(`/v1/instances/${instanceId}/onboarding/business_details`)
    expect(onboarding.status).toBe(404)
  })

  test('POST /v1/e/instances/:id/tos returns 201', async () => {
    const app = createMockServer()
    const res = await app.request(`/v1/e/instances/${instanceId}/tos`, { method: 'POST' })
    expect(res.status).toBe(201)
    const json = await res.json() as any
    expect(json.accepted).toBe(true)
  })

  test('GET receiver limit-increase', async () => {
    const app = createMockServer()
    const receivers = store.listByInstance(store.receivers, instanceId)
    const receiverId = receivers[0]?.id
    if (!receiverId)
      return
    const res = await app.request(`/v1/instances/${instanceId}/receivers/${receiverId}/limit-increase`)
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.data).toBeDefined()
  })

  describe('internal routes', () => {
    test('GET /_internal/status returns store counts', async () => {
      const app = createMockServer()
      const res = await app.request('/_internal/status')
      expect(res.status).toBe(200)
      const json = await res.json() as any
      expect(typeof json.instances).toBe('number')
      expect(typeof json.receivers).toBe('number')
      expect(typeof json.bankAccounts).toBe('number')
      expect(typeof json.blockchainWallets).toBe('number')
      expect(typeof json.payouts).toBe('number')
      expect(typeof json.payins).toBe('number')
    })

    test('POST /_internal/trigger accepts event and dispatches', async () => {
      const app = createMockServer()
      await app.request('/_internal/forward-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: ['https://example.com/hook'] }),
      })
      const res = await app.request('/_internal/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'receiver.new' }),
      })
      expect(res.status).toBe(200)
      const json = await res.json() as any
      expect(json.success).toBe(true)
      expect(typeof json.sent).toBe('number')
    })

    test('POST /_internal/trigger with payoutId', async () => {
      const app = createMockServer()
      await app.request('/_internal/forward-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: ['https://example.com/hook'] }),
      })
      const payouts = store.listByInstance(store.payouts, instanceId)
      const payoutId = payouts[0]?.id
      if (!payoutId)
        return
      const res = await app.request('/_internal/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'payout.complete', payoutId }),
      })
      expect(res.status).toBe(200)
      const json = await res.json() as any
      expect(json.success).toBe(true)
      expect(typeof json.sent).toBe('number')
    })

    test('POST /_internal/advance advances payout', async () => {
      const app = createMockServer()
      const payouts = store.listByInstance(store.payouts, instanceId)
      const payoutId = payouts[0]?.id
      if (!payoutId)
        return
      const res = await app.request('/_internal/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource: 'payout', id: payoutId }),
      })
      expect(res.status).toBe(200)
      const json = await res.json() as any
      expect(json.id).toBe(payoutId)
      expect(json.status).toBeDefined()
    })

    test('GET /_internal/forward-urls returns array', async () => {
      const app = createMockServer()
      const res = await app.request('/_internal/forward-urls')
      expect(res.status).toBe(200)
      const json = await res.json() as any
      expect(Array.isArray(json.urls)).toBe(true)
    })

    test('POST /_internal/forward-urls updates urls', async () => {
      const app = createMockServer()
      const res = await app.request('/_internal/forward-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: ['https://example.com/hook'] }),
      })
      expect(res.status).toBe(200)
      const getRes = await app.request('/_internal/forward-urls')
      const json = await getRes.json() as any
      expect(json.urls).toContain('https://example.com/hook')
    })
  })
})
