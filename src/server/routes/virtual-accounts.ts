import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import { dispatchWebhook } from '../../webhooks/dispatcher'
import type { VirtualAccount } from '../../types'

const app = new Hono()

// List virtual accounts for a receiver
app.get('/', (c) => {
  const instanceId = param(c, 'instanceId')
  const receiverId = param(c, 'receiverId')
  const accounts = store.listByInstanceAndReceiver(store.virtualAccounts, instanceId, receiverId)
  return c.json({ data: accounts, has_more: false })
})

// Get virtual account
app.get('/:accountId', (c) => {
  const accountId = param(c, 'accountId')
  const account = store.virtualAccounts.get(accountId)
  if (!account) return c.json({ success: false, message: 'Virtual account not found' }, 404)
  return c.json(account)
})

// Create virtual account
app.post('/', async (c) => {
  const instanceId = param(c, 'instanceId')
  const receiverId = param(c, 'receiverId')
  const body = await c.req.json()
  const now = new Date().toISOString()

  const account: VirtualAccount = {
    id: generateId('virtualAccount'),
    receiver_id: receiverId,
    blockchain_wallet_id: body.blockchain_wallet_id,
    instance_id: instanceId,
    kyc_status: 'approved',
    account_number: `VA${Date.now().toString().slice(-10)}`,
    routing_number: '021000021',
    created_at: now,
    updated_at: now,
  }

  store.virtualAccounts.set(account.id, account)
  await dispatchWebhook('virtualAccount.new', account)
  return c.json(account, 201)
})

// Update virtual account
app.put('/:accountId', async (c) => {
  const accountId = param(c, 'accountId')
  const account = store.virtualAccounts.get(accountId)
  if (!account) return c.json({ success: false, message: 'Virtual account not found' }, 404)

  const body = await c.req.json()
  const updated = { ...account, ...body, id: account.id, instance_id: account.instance_id, updated_at: new Date().toISOString() }
  store.virtualAccounts.set(accountId, updated)
  return c.json(updated)
})

export default app
