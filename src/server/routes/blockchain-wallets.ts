import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import { dispatchWebhook } from '../../webhooks/dispatcher'
import type { BlockchainWallet } from '../../types'

function buildBlockchainWalletOut(wallet: BlockchainWallet) {
  const { instance_id: _iid, created_at: _ca, updated_at: _ua, ...rest } = wallet
  return rest
}

const app = new Hono()

// List blockchain wallets for a receiver
app.get('/', (c) => {
  const instanceId = param(c, 'instanceId')
  const receiverId = param(c, 'receiverId')
  const wallets = store.listByInstanceAndReceiver(store.blockchainWallets, instanceId, receiverId)
  return c.json({ data: wallets.map(buildBlockchainWalletOut), has_more: false, next_page: null, prev_page: null })
})

// Get blockchain wallet
app.get('/:walletId', (c) => {
  const walletId = param(c, 'walletId')
  const wallet = store.blockchainWallets.get(walletId)
  if (!wallet) return c.json({ success: false, message: 'Blockchain wallet not found' }, 404)
  return c.json(buildBlockchainWalletOut(wallet))
})

// Get sign message
app.get('/sign-message', (c) => {
  return c.json({ message: 'Sign this message to verify wallet ownership: blindpay-mock-verification' })
})

// Create blockchain wallet
app.post('/', async (c) => {
  const instanceId = param(c, 'instanceId')
  const receiverId = param(c, 'receiverId')
  const body = await c.req.json()
  const now = new Date().toISOString()

  const wallet = {
    id: generateId('blockchainWallet'),
    address: body.address,
    network: body.network || 'base',
    is_account_abstraction: body.is_account_abstraction || false,
    receiver_id: receiverId,
    instance_id: instanceId,
    external_id: body.external_id || null,
    created_at: now,
    updated_at: now,
  }

  store.blockchainWallets.set(wallet.id, wallet)
  await dispatchWebhook('blockchainWallet.new', wallet)
  return c.json(buildBlockchainWalletOut(wallet), 201)
})

// Delete blockchain wallet
app.delete('/:walletId', (c) => {
  const walletId = param(c, 'walletId')
  if (!store.blockchainWallets.has(walletId)) return c.json({ success: false, message: 'Blockchain wallet not found' }, 404)
  store.blockchainWallets.delete(walletId)
  return c.json({ success: true })
})

export default app
