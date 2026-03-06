import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import { dispatchWebhook } from '../../webhooks/dispatcher'
import { schedulePayinAdvancement } from '../../lifecycle/index'
import type { Payin } from '../../types'

const app = new Hono()

function buildPayinOut(payin: Payin) {
  const quote = store.payinQuotes.get(payin.payin_quote_id)
  return {
    id: payin.id,
    status: payin.status,
    pix_code: payin.pix_code,
    clabe: payin.clabe,
    tracking_transaction: payin.tracking_transaction,
    tracking_payment: payin.tracking_payment,
    tracking_complete: payin.tracking_complete,
    tracking_partner_fee: payin.tracking_partner_fee,
    blockchain_wallet_id: quote?.blockchain_wallet_id ?? null,
    network: quote?.network ?? null,
    token: quote?.token ?? null,
    sender_amount: quote?.sender_amount ?? null,
    receiver_amount: quote?.receiver_amount ?? null,
    currency: quote?.currency ?? null,
    payment_method: quote?.payment_method ?? null,
    created_at: payin.created_at,
    updated_at: payin.updated_at,
  }
}

// List payins
app.get('/', (c) => {
  const instanceId = param(c, 'instanceId')
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')

  const payins = store.listByInstance(store.payins, instanceId)
  const result = store.paginate(payins, limit, offset)
  return c.json({ ...result, data: result.data.map(buildPayinOut) })
})

// Get payin
app.get('/:payinId', (c) => {
  const payinId = param(c, 'payinId')
  const payin = store.payins.get(payinId)
  if (!payin) return c.json({ success: false, message: 'Payin not found' }, 404)
  return c.json(buildPayinOut(payin))
})

// Create payin on EVM
app.post('/evm', async (c) => {
  const instanceId = param(c, 'instanceId')
  const body = await c.req.json()

  const quote = store.payinQuotes.get(body.payin_quote_id)
  if (!quote) return c.json({ success: false, message: 'Payin quote not found' }, 400)

  const now = new Date().toISOString()

  // Generate mock payment instructions based on payment method
  let pixCode: string | null = null
  let clabe: string | null = null
  if (quote.payment_method === 'pix') {
    pixCode = `00020126580014br.gov.bcb.pix0136mock-${Date.now()}5204000053039865802BR`
  } else if (quote.payment_method === 'spei') {
    clabe = `6461801234567890${Math.floor(Math.random() * 10)}`
  }

  const payin: Payin = {
    id: generateId('payin'),
    status: 'processing',
    pix_code: pixCode,
    clabe,
    payin_quote_id: body.payin_quote_id,
    instance_id: instanceId,
    external_id: body.external_id || null,
    partner_fee: 0,
    tracking_transaction: { step: 'processing' },
    tracking_payment: { step: 'processing' },
    tracking_complete: { step: 'processing' },
    tracking_partner_fee: null,
    created_at: now,
    updated_at: now,
  }

  store.payins.set(payin.id, payin)
  await dispatchWebhook('payin.new', buildPayinOut(payin))
  schedulePayinAdvancement(payin.id)

  return c.json(buildPayinOut(payin), 201)
})

export default app
