import * as clack from '@clack/prompts'
import { apiPost, getBaseUrl, NOT_RUNNING_MSG } from '../utils/api-client'
import { formatOutput } from '../utils/output'
import { webhookEvents } from '../utils/constants'
import type { WebhookEvent } from '../types'
import process from 'node:process'

export async function triggerEvent(
  eventName: string,
  options: { payoutId?: string, payinId?: string, json?: boolean, port?: number },
) {
  if (!webhookEvents.includes(eventName as WebhookEvent)) {
    clack.log.error(`Unknown event: ${eventName}`)
    clack.log.message(`Available events: ${webhookEvents.join(', ')}`)
    clack.cancel('Exiting.')
    process.exit(1)
  }

  const baseUrl = getBaseUrl(options.port)
  const body = { event: eventName, payoutId: options.payoutId, payinId: options.payinId }

  const s = clack.spinner()
  if (!options.json)
    s.start(`Triggering ${eventName}...`)
  try {
    const result = await apiPost<{ success: boolean, sent?: number, message?: string }>(baseUrl, '/_internal/trigger', body)
    if (options.json) {
      console.log(formatOutput(result, true))
      return
    }
    s.stop('Webhook delivered')
    if (result.success && result.sent !== null && result.sent !== undefined) {
      clack.log.success(`Event ${eventName} sent to ${result.sent} endpoint(s)`)
    }
    else {
      clack.log.error(result.message ?? 'Trigger failed')
      clack.cancel('Exiting.')
      process.exit(1)
    }
  }
  catch (e: any) {
    if (!options.json)
      s.stop('Failed')
    if (e?.message === NOT_RUNNING_MSG || e?.code === 'ECONNREFUSED') {
      clack.log.error(NOT_RUNNING_MSG)
    }
    else if (e?.message?.includes('No forward URLs')) {
      clack.log.error('No forward URLs configured. The mock server must be running with --forward-to.')
      clack.log.message('Start the mock server first: blindpay mock --forward-to http://localhost:3000/webhooks')
    }
    else {
      clack.log.error(e?.message ?? 'Trigger failed')
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}
