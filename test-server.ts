/**
 * Local webhook receiver for testing CLI webhook forwarding.
 * Verifies Svix signatures using the same secret as the mock server.
 *
 * Usage:
 *   bun run test-server.ts
 *
 * Then start the mock server with:
 *   blindpay mock --forward-to http://localhost:3333/webhooks
 *
 * Trigger events (create resources or run `blindpay trigger <event>`)
 * and watch this server log incoming webhooks and signature verification.
 */

import { createHmac } from 'node:crypto'

const PORT = 3333
const WEBHOOK_SIGNING_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'

function getSigningKey(secret: string): Buffer {
  const parts = secret.split('_')
  if (parts.length < 2)
    throw new Error('Invalid Svix secret format')
  return Buffer.from(parts[1], 'base64')
}

function verifySignature(payload: string, msgId: string, timestamp: string, signatureHeader: string): boolean {
  const toSign = `${msgId}.${timestamp}.${payload}`
  const key = getSigningKey(WEBHOOK_SIGNING_SECRET)
  const expected = createHmac('sha256', key).update(toSign).digest('base64')
  // Svix-Signature can be "v1,sig" or "v1,sig v1,sig2 ..."
  const parts = signatureHeader.split(/\s+/)
  for (const part of parts) {
    const [version, sig] = part.split(',')
    if (version === 'v1' && sig === expected)
      return true
  }
  return false
}

const green = (s: string) => `\x1B[32m${s}\x1B[0m`
const red = (s: string) => `\x1B[31m${s}\x1B[0m`
const dim = (s: string) => `\x1B[2m${s}\x1B[0m`

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const rawBody = await req.text()
    const svixId = req.headers.get('svix-id') ?? req.headers.get('Svix-Id') ?? ''
    const svixTimestamp = req.headers.get('svix-timestamp') ?? req.headers.get('Svix-Timestamp') ?? ''
    const svixSignature = req.headers.get('svix-signature') ?? req.headers.get('Svix-Signature') ?? ''

    let valid = false
    if (svixId && svixTimestamp && svixSignature) {
      valid = verifySignature(rawBody, svixId, svixTimestamp, svixSignature)
    }

    const statusIcon = valid ? green('✓') : red('✗')
    const statusText = valid ? green('Signature valid') : red('Signature invalid')

    console.log('')
    console.log(`${statusIcon} ${statusText}  ${dim(`${req.method} ${url.pathname}`)}`)
    console.log(dim('  Svix-Id:        ') + svixId)
    console.log(dim('  Svix-Timestamp: ') + svixTimestamp)
    console.log(`${dim('  Svix-Signature: ')}${svixSignature.slice(0, 30)}...`)

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    }
    catch {
      body = rawBody
    }
    const event = (body as any)?.webhook_event ?? '(unknown)'
    console.log(dim('  Event:          ') + event)
    console.log(dim('  Body:'))
    console.log(JSON.stringify(body, null, 2).split('\n').map(l => `  ${l}`).join('\n'))
    console.log('')

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  },
})

console.log(`Webhook test server listening on http://localhost:${server.port}`)
console.log(`Start the mock server with: blindpay mock --forward-to http://localhost:${server.port}/webhooks`)
console.log('')
