import * as clack from '@clack/prompts'
import pc from 'picocolors'

function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

export const logger = {
  request(method: string, path: string, status: number, duration: number) {
    const statusColor = status < 300 ? pc.green : status < 400 ? pc.yellow : pc.red
    clack.log.info(
      `${pc.dim(`[${timestamp()}]`)} ${pc.bold(method.padEnd(6))} ${path} ${pc.dim('->')} ${statusColor(String(status))} ${pc.dim(`(${duration}ms)`)}`,
    )
  },

  webhook(event: string, url: string, status: number | string) {
    const statusStr = typeof status === 'number'
      ? (status < 300 ? pc.green(`${status} OK`) : pc.red(`${status}`))
      : pc.red(status)
    clack.log.info(
      `${pc.dim(`[${timestamp()}]`)}  ${pc.cyan('->')} ${pc.magenta(event)} sent to ${pc.underline(url)} (${statusStr})`,
    )
  },

  lifecycle(resource: string, id: string, from: string, to: string) {
    clack.log.step(`${resource} ${pc.bold(id)}: ${pc.dim(from)} -> ${pc.green(to)}`)
  },

  info(message: string) {
    clack.log.info(message)
  },

  error(message: string) {
    clack.log.error(message)
  },

  success(message: string) {
    clack.log.success(message)
  },

  banner(port: number, forwardTo: string[]) {
    console.log()
    clack.log.message(`${pc.bold(pc.cyan('Blindpay Mock Server'))} ${pc.dim('v0.1.0')}`)
    clack.log.message(`${pc.dim('Running on')} ${pc.bold(`http://localhost:${port}`)}`)
    console.log()
    if (forwardTo.length > 0) {
      clack.log.message(pc.dim('Forwarding webhooks to:'))
      for (const url of forwardTo) {
        clack.log.message(`  ${pc.cyan('->')} ${pc.underline(url)}`)
      }
      console.log()
    }
  },

  seedInfo(counts: { instances: number, receivers: number, bankAccounts: number, blockchainWallets: number }) {
    clack.log.message(pc.dim('Pre-seeded data:'))
    clack.log.message(`  ${counts.instances} instance, ${counts.receivers} receivers, ${counts.bankAccounts} bank accounts, ${counts.blockchainWallets} blockchain wallets`)
    console.log()
    clack.log.success(`Ready! ${pc.dim('Waiting for requests...')}`)
    console.log()
  },
}
