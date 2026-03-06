import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import type { ApiKey } from '../../types'

const app = new Hono()

// List API keys
app.get('/', (c) => {
  const instanceId = param(c, 'instanceId')
  const keys = store.listByInstance(store.apiKeys, instanceId)
  return c.json({ data: keys.map(k => ({ ...k, key: k.key.slice(0, 12) + '...' })), has_more: false })
})

// Get API key
app.get('/:keyId', (c) => {
  const keyId = param(c, 'keyId')
  const key = store.apiKeys.get(keyId)
  if (!key) return c.json({ success: false, message: 'API key not found' }, 404)
  return c.json({ ...key, key: key.key.slice(0, 12) + '...' })
})

// Create API key
app.post('/', async (c) => {
  const instanceId = param(c, 'instanceId')
  const body = await c.req.json()
  const now = new Date().toISOString()

  const key: ApiKey = {
    id: generateId('apiKey'),
    name: body.name || 'New API Key',
    key: `bpk_test_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    key_id: `key_${Date.now().toString(36)}`,
    permission: 'full_access',
    instance_id: instanceId,
    created_at: now,
    updated_at: now,
  }

  store.apiKeys.set(key.id, key)
  return c.json(key, 201)
})

// Delete API key
app.delete('/:keyId', (c) => {
  const keyId = param(c, 'keyId')
  if (!store.apiKeys.has(keyId)) return c.json({ success: false, message: 'API key not found' }, 404)
  store.apiKeys.delete(keyId)
  return c.json({ success: true })
})

export default app
