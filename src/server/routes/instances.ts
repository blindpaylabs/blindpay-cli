import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import type { Instance } from '../../types'

const app = new Hono()

/** Internal fields that must not be exposed in instance API responses */
const INSTANCE_INTERNAL_KEYS = ['checkbook_platform_id', 'billing_solana_wallet'] as const

function buildInstanceOut(instance: Instance): Record<string, unknown> {
  const out = { ...instance }
  INSTANCE_INTERNAL_KEYS.forEach(k => delete (out as Record<string, unknown>)[k])
  return out
}

// List instances
app.get('/', (c) => {
  const instances = Array.from(store.instances.values()).map(buildInstanceOut)
  return c.json({ data: instances })
})

// Create instance
app.post('/', async (c) => {
  const body = await c.req.json()
  const now = new Date().toISOString()

  const instance: Instance = {
    id: generateId('instance'),
    name: body.name || 'New Instance',
    type: 'development',
    onboarding_step: 'completed',
    subscription_plan: null,
    subscription_status: null,
    created_at: now,
    updated_at: now,
  }

  store.instances.set(instance.id, instance)
  return c.json(buildInstanceOut(instance), 201)
})

// Get instance
app.get('/:instanceId', (c) => {
  const instanceId = param(c, 'instanceId')
  const instance = store.instances.get(instanceId)
  if (!instance) return c.json({ success: false, message: 'Instance not found' }, 404)
  return c.json(buildInstanceOut(instance))
})

// Update instance
app.put('/:instanceId', async (c) => {
  const instanceId = param(c, 'instanceId')
  const instance = store.instances.get(instanceId)
  if (!instance) return c.json({ success: false, message: 'Instance not found' }, 404)

  const body = await c.req.json()
  const updated = { ...instance, ...body, id: instance.id, updated_at: new Date().toISOString() }
  store.instances.set(instanceId, updated)
  return c.json(buildInstanceOut(updated))
})

// Delete instance
app.delete('/:instanceId', (c) => {
  const instanceId = param(c, 'instanceId')
  if (!store.instances.has(instanceId)) return c.json({ success: false, message: 'Instance not found' }, 404)
  store.instances.delete(instanceId)
  return c.json({ success: true })
})

export default app
