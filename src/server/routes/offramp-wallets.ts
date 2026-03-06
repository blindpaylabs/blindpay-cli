import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import type { OfframpWallet } from '../../types'

const app = new Hono()

// List offramp wallets
app.get('/', (c) => {
  const instanceId = param(c, 'instanceId')
  const receiverId = param(c, 'receiverId')
  const bankAccountId = param(c, 'bankAccountId')
  const wallets = Array.from(store.offrampWallets.values()).filter(
    w => w.instance_id === instanceId && w.receiver_id === receiverId && w.bank_account_id === bankAccountId
  )
  return c.json({ data: wallets, has_more: false })
})

// Get offramp wallet
app.get('/:walletId', (c) => {
  const walletId = param(c, 'walletId')
  const wallet = store.offrampWallets.get(walletId)
  if (!wallet) return c.json({ success: false, message: 'Offramp wallet not found' }, 404)
  return c.json(wallet)
})

// Create offramp wallet
app.post('/', async (c) => {
  const instanceId = param(c, 'instanceId')
  const receiverId = param(c, 'receiverId')
  const bankAccountId = param(c, 'bankAccountId')
  const body = await c.req.json()
  const now = new Date().toISOString()

  const wallet: OfframpWallet = {
    id: generateId('offrampWallet'),
    address: `0xmock${Date.now().toString(16).padStart(32, '0')}`,
    network: body.network || 'base',
    external_id: body.external_id || null,
    bank_account_id: bankAccountId,
    receiver_id: receiverId,
    instance_id: instanceId,
    created_at: now,
    updated_at: now,
  }

  store.offrampWallets.set(wallet.id, wallet)
  return c.json({ id: wallet.id, address: wallet.address, network: wallet.network, external_id: wallet.external_id }, 201)
})

export default app
