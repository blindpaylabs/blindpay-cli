import { createHmac } from 'node:crypto'
import type { WebhookEvent } from '../types'
import { WEBHOOK_SIGNING_SECRET } from '../utils/constants'
import { logger } from '../utils/logger'

let forwardUrls: string[] = []

export function setForwardUrls(urls: string[]) {
  forwardUrls = urls
}

export function getForwardUrls(): string[] {
  return forwardUrls
}

/** Get the raw key bytes from Svix secret format whsec_<base64> */
function getSigningKey(secret: string): Buffer {
  const parts = secret.split('_')
  if (parts.length < 2)
    throw new Error('Invalid Svix secret format')
  return Buffer.from(parts[1], 'base64')
}

function signPayload(payload: string, timestamp: string, msgId: string): string {
  const toSign = `${msgId}.${timestamp}.${payload}`
  const key = getSigningKey(WEBHOOK_SIGNING_SECRET)
  const signature = createHmac('sha256', key).update(toSign).digest('base64')
  return `v1,${signature}`
}

export async function dispatchWebhook(event: WebhookEvent, data: Record<string, any>) {
  if (forwardUrls.length === 0)
    return

  const payload = JSON.stringify({ webhook_event: event, ...data })
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = signPayload(payload, timestamp, msgId)

  for (const url of forwardUrls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Svix-Id': msgId,
          'Svix-Timestamp': timestamp,
          'Svix-Signature': signature,
          'User-Agent': 'Blindpay-CLI/0.1.0',
        },
        body: payload,
      })
      logger.webhook(event, url, response.status)
    }
    catch (err: any) {
      logger.webhook(event, url, err.message || 'Connection refused')
    }
  }
}
