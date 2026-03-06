import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { param } from '../utils/hono'
import { logger } from '../utils/logger'
import { store } from '../store/index'
import { advancePayout, advancePayin } from '../lifecycle/index'
import { getForwardUrls, setForwardUrls } from '../webhooks/dispatcher'
import { handleTrigger } from './internal/trigger-handler'
import type { PayoutStatus } from '../types'

import receiversRoutes from './routes/receivers'
import bankAccountsRoutes from './routes/bank-accounts'
import blockchainWalletsRoutes from './routes/blockchain-wallets'
import quotesRoutes from './routes/quotes'
import payoutsRoutes from './routes/payouts'
import payinQuotesRoutes from './routes/payin-quotes'
import payinsRoutes from './routes/payins'
import apiKeysRoutes from './routes/api-keys'
import webhookEndpointsRoutes from './routes/webhook-endpoints'
import partnerFeesRoutes from './routes/partner-fees'
import virtualAccountsRoutes from './routes/virtual-accounts'
import offrampWalletsRoutes from './routes/offramp-wallets'
import availableRoutes from './routes/available'
import instancesRoutes from './routes/instances'

export function createMockServer() {
  const app = new Hono()

  // Middleware
  app.use('*', cors())

  // Request logging
  app.use('*', async (c, next) => {
    const start = Date.now()
    await next()
    const duration = Date.now() - start
    logger.request(c.req.method, c.req.path, c.res.status, duration)
  })

  // Health check
  app.get('/', (c) => c.json({ name: 'Blindpay Mock API', version: '0.1.0', status: 'running' }))
  app.get('/v1', (c) => c.json({ name: 'Blindpay Mock API', version: '0.1.0', status: 'running' }))

  // Public routes
  app.route('/v1/available', availableRoutes)

  // Instance routes
  app.route('/v1/instances', instancesRoutes)

  // Instance-scoped resource routes
  const instanceBase = '/v1/instances/:instanceId'

  app.route(`${instanceBase}/receivers`, receiversRoutes)
  app.route(`${instanceBase}/receivers/:receiverId/bank-accounts`, bankAccountsRoutes)
  app.route(`${instanceBase}/receivers/:receiverId/blockchain-wallets`, blockchainWalletsRoutes)
  app.route(`${instanceBase}/receivers/:receiverId/virtual-accounts`, virtualAccountsRoutes)
  app.route(`${instanceBase}/receivers/:receiverId/bank-accounts/:bankAccountId/offramp-wallets`, offrampWalletsRoutes)

  app.route(`${instanceBase}/quotes`, quotesRoutes)
  app.route(`${instanceBase}/payouts`, payoutsRoutes)
  app.route(`${instanceBase}/payin-quotes`, payinQuotesRoutes)
  app.route(`${instanceBase}/payins`, payinsRoutes)

  app.route(`${instanceBase}/api-keys`, apiKeysRoutes)
  app.route(`${instanceBase}/webhook-endpoints`, webhookEndpointsRoutes)
  app.route(`${instanceBase}/partner-fees`, partnerFeesRoutes)

  // External tracking routes (no auth)
  app.get('/v1/e/payouts/:payoutId', (c) => {
    const payoutId = param(c, 'payoutId')
    const payout = store.payouts.get(payoutId)
    if (!payout) return c.json({ success: false, message: 'Payout not found' }, 404)
    return c.json(payout)
  })

  app.get('/v1/e/payins/:payinId', (c) => {
    const payinId = param(c, 'payinId')
    const payin = store.payins.get(payinId)
    if (!payin) return c.json({ success: false, message: 'Payin not found' }, 404)
    return c.json(payin)
  })

  // Terms of Service (public API)
  app.post('/v1/e/instances/:id/tos', async (c) => {
    return c.json({ accepted: true, accepted_at: new Date().toISOString() }, 201)
  })
  app.put('/v1/e/tos', async (c) => {
    return c.json({ accepted: true, accepted_at: new Date().toISOString() })
  })

  // Upload (mock)
  app.post('/v1/upload', async (c) => {
    return c.json({ url: 'https://mock.blindpay.com/uploads/mock-file.pdf' }, 201)
  })

  // Solana/Stellar mock endpoints
  app.post(`${instanceBase}/mint-usdb-solana`, (c) => c.json({ success: true, transaction_hash: `0xmock${Date.now().toString(16)}` }))
  app.post(`${instanceBase}/prepare-delegate-solana`, (c) => c.json({ success: true, transaction: 'mock_transaction_base64' }))
  app.post(`${instanceBase}/create-asset-trustline`, (c) => c.json({ success: true }))
  app.post(`${instanceBase}/mint-usdb-stellar`, (c) => c.json({ success: true, transaction_hash: `mock_stellar_${Date.now()}` }))

  // Internal CLI routes (status, trigger, advance, forward-urls)
  app.get('/_internal/status', (c) => {
    return c.json({
      instances: store.instances.size,
      receivers: store.receivers.size,
      bankAccounts: store.bankAccounts.size,
      blockchainWallets: store.blockchainWallets.size,
      quotes: store.quotes.size,
      payouts: store.payouts.size,
      payinQuotes: store.payinQuotes.size,
      payins: store.payins.size,
      apiKeys: store.apiKeys.size,
      webhookEndpoints: store.webhookEndpoints.size,
      partnerFees: store.partnerFees.size,
      virtualAccounts: store.virtualAccounts.size,
      offrampWallets: store.offrampWallets.size,
    })
  })

  app.post('/_internal/trigger', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { event?: string; payoutId?: string; payinId?: string }
    const event = body.event
    if (!event || typeof event !== 'string') {
      return c.json({ success: false, message: 'Missing or invalid event' }, 400)
    }
    try {
      const result = await handleTrigger(event, { payoutId: body.payoutId, payinId: body.payinId })
      return c.json({ success: true, sent: result.sent })
    } catch (err: any) {
      return c.json({ success: false, message: err.message ?? 'Trigger failed' }, 400)
    }
  })

  app.post('/_internal/advance', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { resource?: string; id?: string; to?: string }
    const { resource, id, to } = body
    if (!resource || !id) {
      return c.json({ success: false, message: 'Missing resource or id' }, 400)
    }
    try {
      if (resource === 'payout') {
        const payout = await advancePayout(id, to as PayoutStatus | undefined)
        return c.json({ success: true, resource: 'payout', data: payout })
      }
      if (resource === 'payin') {
        const payin = await advancePayin(id, to)
        return c.json({ success: true, resource: 'payin', data: payin })
      }
      return c.json({ success: false, message: `Unknown resource: ${resource}. Use 'payout' or 'payin'.` }, 400)
    } catch (err: any) {
      return c.json({ success: false, message: err.message ?? 'Advance failed' }, 400)
    }
  })

  app.get('/_internal/forward-urls', (c) => c.json({ urls: getForwardUrls() }))
  app.post('/_internal/forward-urls', async (c) => {
    const body = await c.req.json().catch(() => ({})) as { urls?: string[] }
    const urls = Array.isArray(body?.urls) ? body.urls : []
    setForwardUrls(urls)
    return c.json({ success: true, urls })
  })

  // Catch-all for unknown routes
  app.all('*', (c) => {
    return c.json({ success: false, message: `Route not found: ${c.req.method} ${c.req.path}` }, 404)
  })

  return app
}
