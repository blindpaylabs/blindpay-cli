import * as clack from '@clack/prompts'
import pc from 'picocolors'
import { apiPost, getBaseUrl, NOT_RUNNING_MSG } from '../utils/api-client'
import { formatOutput } from '../utils/output'

export async function advanceResource(
  resource: string,
  id: string,
  options: { to?: string; json?: boolean; port?: number },
) {
  if (resource !== 'payout' && resource !== 'payin') {
    clack.log.error(`Unknown resource: ${resource}. Use 'payout' or 'payin'.`)
    clack.cancel('Exiting.')
    process.exit(1)
  }

  const baseUrl = getBaseUrl(options.port)
  try {
    const result = await apiPost<{ success: boolean; resource: string; data: any; message?: string }>(
      baseUrl,
      '/_internal/advance',
      { resource, id, to: options.to },
    )
    if (!result.success) {
      clack.log.error(result.message ?? 'Advance failed')
      clack.cancel('Exiting.')
      process.exit(1)
    }
    if (options.json) {
      console.log(formatOutput(result, true))
      return
    }
    const data = result.data
    if (result.resource === 'payout' && data) {
      clack.log.step(`Payout ${pc.bold(id)} → ${pc.bold(data.status)}`)
      clack.log.message(`  tracking_transaction: ${data.tracking_transaction?.step ?? '-'}`)
      clack.log.message(`  tracking_payment: ${data.tracking_payment?.step ?? '-'}`)
      clack.log.message(`  tracking_complete: ${data.tracking_complete?.step ?? '-'}`)
    } else if (result.resource === 'payin' && data) {
      clack.log.step(`Payin ${pc.bold(id)} → ${pc.bold(data.status)}`)
      clack.log.message(`  tracking_payment: ${data.tracking_payment?.step ?? '-'}`)
      clack.log.message(`  tracking_transaction: ${data.tracking_transaction?.step ?? '-'}`)
      clack.log.message(`  tracking_complete: ${data.tracking_complete?.step ?? '-'}`)
    }
  } catch (e: any) {
    if (e?.message === NOT_RUNNING_MSG || e?.code === 'ECONNREFUSED') {
      clack.log.error(NOT_RUNNING_MSG)
    } else {
      clack.log.error(e?.message ?? 'Advance failed')
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}
