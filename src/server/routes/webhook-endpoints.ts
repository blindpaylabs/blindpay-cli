import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import { WEBHOOK_SIGNING_SECRET } from '../../utils/constants'
import type { WebhookEndpoint } from '../../types'

const app = new Hono()

// List webhook endpoints
app.get('/', (c) => {
  const instanceId = param(c, 'instanceId')
  const endpoints = store.listByInstance(store.webhookEndpoints, instanceId)
  return c.json({ data: endpoints, has_more: false })
})

// Get webhook secret
app.get('/:endpointId/secret', (c) => {
  const endpointId = param(c, 'endpointId')
  if (!store.webhookEndpoints.has(endpointId)) return c.json({ success: false, message: 'Webhook endpoint not found' }, 404)
  return c.json({ secret: WEBHOOK_SIGNING_SECRET })
})

// Get portal access URL (mock)
app.get('/portal-access', (c) => {
  return c.json({ url: 'http://localhost:4242/_dashboard/webhooks' })
})

// Create webhook endpoint
app.post('/', async (c) => {
  const instanceId = param(c, 'instanceId')
  const body = await c.req.json()
  const now = new Date().toISOString()

  const endpoint: WebhookEndpoint = {
    id: generateId('webhookEndpoint'),
    url: body.url,
    description: body.description || null,
    instance_id: instanceId,
    created_at: now,
    updated_at: now,
  }

  store.webhookEndpoints.set(endpoint.id, endpoint)
  return c.json(endpoint, 201)
})

// Delete webhook endpoint
app.delete('/:endpointId', (c) => {
  const endpointId = param(c, 'endpointId')
  if (!store.webhookEndpoints.has(endpointId)) return c.json({ success: false, message: 'Webhook endpoint not found' }, 404)
  store.webhookEndpoints.delete(endpointId)
  return c.json({ success: true })
})

export default app
