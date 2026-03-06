import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import { dispatchWebhook } from '../../webhooks/dispatcher'

const app = new Hono()

// List receivers
app.get('/', (c) => {
  const instanceId = param(c, 'instanceId')
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')
  const fullName = c.req.query('full_name')

  let receivers = store.listByInstance(store.receivers, instanceId)

  if (fullName) {
    const search = fullName.toLowerCase()
    receivers = receivers.filter(r => {
      const name = r.type === 'individual'
        ? `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase()
        : (r.legal_name || '').toLowerCase()
      return name.includes(search)
    })
  }

  const result = store.paginate(receivers, limit, offset)
  return c.json(result)
})

// Receiver limit increase (public API) - must be before /:receiverId
app.get('/:receiverId/limit-increase', (c) => {
  const receiverId = param(c, 'receiverId')
  if (!store.receivers.has(receiverId)) return c.json({ success: false, message: 'Receiver not found' }, 404)
  return c.json({ data: [], has_more: false })
})
app.post('/:receiverId/limit-increase', async (c) => {
  const receiverId = param(c, 'receiverId')
  if (!store.receivers.has(receiverId)) return c.json({ success: false, message: 'Receiver not found' }, 404)
  const body = await c.req.json().catch(() => ({}))
  return c.json({
    id: `li_${Date.now()}`,
    receiver_id: receiverId,
    status: 'pending',
    requested_at: new Date().toISOString(),
    ...body,
  }, 201)
})

// Get receiver
app.get('/:receiverId', (c) => {
  const receiverId = param(c, 'receiverId')
  const receiver = store.receivers.get(receiverId)
  if (!receiver) return c.json({ success: false, message: 'Receiver not found' }, 404)
  return c.json({
    ...receiver,
    limit: { per_transaction: 1000000, daily: 5000000, monthly: 25000000 },
    is_tos_accepted: true,
  })
})

// Create receiver
app.post('/', async (c) => {
  const instanceId = param(c, 'instanceId')
  const body = await c.req.json()
  const now = new Date().toISOString()

  const receiver = {
    id: generateId('receiver'),
    type: body.type || 'individual',
    kyc_type: body.kyc_type || 'standard',
    kyc_status: (body.kyc_status && ['verifying', 'approved', 'rejected', 'deprecated'].includes(body.kyc_status) ? body.kyc_status : 'approved') as 'verifying' | 'approved' | 'rejected' | 'deprecated',
    kyc_warnings: [],
    fraud_warnings: [],
    email: body.email,
    tax_id: body.tax_id || null,
    address_line_1: body.address_line_1 || null,
    address_line_2: body.address_line_2 || null,
    city: body.city || null,
    state_province_region: body.state_province_region || null,
    country: body.country || 'US',
    postal_code: body.postal_code || null,
    ip_address: body.ip_address || null,
    image_url: body.image_url || null,
    phone_number: body.phone_number || null,
    first_name: body.first_name || null,
    last_name: body.last_name || null,
    date_of_birth: body.date_of_birth || null,
    legal_name: body.legal_name || null,
    alternate_name: body.alternate_name || null,
    external_id: body.external_id || null,
    instance_id: instanceId,
    tos_id: body.tos_id || null,
    owners: body.owners || null,
    created_at: now,
    updated_at: now,
  }

  store.receivers.set(receiver.id, receiver)
  await dispatchWebhook('receiver.new', { ...receiver, limit: { per_transaction: 1000000, daily: 5000000, monthly: 25000000 }, is_tos_accepted: true })
  return c.json({ ...receiver, limit: { per_transaction: 1000000, daily: 5000000, monthly: 25000000 }, is_tos_accepted: true }, 201)
})

// Update receiver
app.put('/:receiverId', async (c) => {
  const receiverId = param(c, 'receiverId')
  const receiver = store.receivers.get(receiverId)
  if (!receiver) return c.json({ success: false, message: 'Receiver not found' }, 404)

  const body = await c.req.json()
  const updated = { ...receiver, ...body, id: receiver.id, instance_id: receiver.instance_id, updated_at: new Date().toISOString() }
  store.receivers.set(receiverId, updated)
  await dispatchWebhook('receiver.update', { ...updated, limit: { per_transaction: 1000000, daily: 5000000, monthly: 25000000 }, is_tos_accepted: true })
  return c.json({ ...updated, limit: { per_transaction: 1000000, daily: 5000000, monthly: 25000000 }, is_tos_accepted: true })
})

// Delete receiver
app.delete('/:receiverId', (c) => {
  const receiverId = param(c, 'receiverId')
  if (!store.receivers.has(receiverId)) return c.json({ success: false, message: 'Receiver not found' }, 404)
  store.receivers.delete(receiverId)
  return c.json({ success: true })
})

// Get receiver limits
app.get('/:receiverId/limits', (c) => {
  const receiverId = param(c, 'receiverId')
  if (!store.receivers.has(receiverId)) return c.json({ success: false, message: 'Receiver not found' }, 404)
  return c.json({ per_transaction: 1000000, daily: 5000000, monthly: 25000000 })
})

export default app
