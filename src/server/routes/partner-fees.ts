import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import type { PartnerFee } from '../../types'

const app = new Hono()

// List partner fees
app.get('/', (c) => {
  const instanceId = param(c, 'instanceId')
  const fees = store.listByInstance(store.partnerFees, instanceId)
  return c.json({ data: fees, has_more: false })
})

// Get partner fee
app.get('/:feeId', (c) => {
  const feeId = param(c, 'feeId')
  const fee = store.partnerFees.get(feeId)
  if (!fee) return c.json({ success: false, message: 'Partner fee not found' }, 404)
  return c.json(fee)
})

// Create partner fee
app.post('/', async (c) => {
  const instanceId = param(c, 'instanceId')
  const body = await c.req.json()
  const now = new Date().toISOString()

  const fee: PartnerFee = {
    id: generateId('partnerFee'),
    payin_percentage_fee: body.payin_percentage_fee ?? 0,
    payin_flat_fee: body.payin_flat_fee ?? 0,
    payout_percentage_fee: body.payout_percentage_fee ?? 0,
    payout_flat_fee: body.payout_flat_fee ?? 0,
    evm_wallet_address: body.evm_wallet_address || null,
    stellar_wallet_address: body.stellar_wallet_address || null,
    solana_wallet_address: body.solana_wallet_address || null,
    instance_id: instanceId,
    created_at: now,
    updated_at: now,
  }

  store.partnerFees.set(fee.id, fee)
  return c.json(fee, 201)
})

// Delete partner fee
app.delete('/:feeId', (c) => {
  const feeId = param(c, 'feeId')
  if (!store.partnerFees.has(feeId)) return c.json({ success: false, message: 'Partner fee not found' }, 404)
  store.partnerFees.delete(feeId)
  return c.json({ success: true })
})

export default app
