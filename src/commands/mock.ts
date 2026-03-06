import * as clack from '@clack/prompts'
import { createServer } from 'node:net'
import process from 'node:process'
import { spawn } from 'node:child_process'
import spinners from 'unicode-animations'
import { serve } from '@hono/node-server'
import { createMockServer } from '../server/index'
import { store } from '../store/index'
import { setForwardUrls } from '../webhooks/dispatcher'
import { setLifecycleOptions } from '../lifecycle/index'
import { logger } from '../utils/logger'
import { WEBHOOK_SIGNING_SECRET } from '../utils/constants'
import { writeServerState, readServerState, removeServerState } from '../utils/server-state'
import type { MockServerOptions } from '../types'

function runBootSpinner(): Promise<void> {
  return new Promise((resolve) => {
    const { frames, interval } = spinners.braille
    let i = 0
    const timer = setInterval(() => {
      process.stdout.write(`\r\x1B[2K  ${frames[i++ % frames.length]} Starting mock server...`)
    }, interval)
    setTimeout(() => {
      clearInterval(timer)
      process.stdout.write('\r\x1B[2K')
      resolve()
    }, 400)
  })
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer()
      .once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE')
          resolve(false)
        else resolve(false)
      })
      .once('listening', () => {
        tester.close(() => resolve(true))
      })
      .listen(port)
  })
}

export async function runMockServer(options: MockServerOptions) {
  const { port, forwardTo, manual, delay, quiet } = options

  setForwardUrls(forwardTo)
  setLifecycleOptions({ manual, delay })

  if (!quiet) {
    clack.intro('Blindpay Mock Server')
  }

  const portAvailable = await checkPort(port)
  if (!portAvailable) {
    if (!quiet) {
      clack.log.error(`Port ${port} is already in use.`)
      clack.log.info('Either stop the other process or use a different port:')
      clack.log.info(`  blindpay mock --port ${port + 1}`)
      clack.outro('Exiting.')
    }
    process.exit(1)
  }

  if (!quiet) {
    const spinner = clack.spinner()
    spinner.start('Starting mock server...')
    await runBootSpinner()
    spinner.stop('Server ready')

    const counts = store.getSeedCounts()
    clack.note(
      `${counts.instances} instance, ${counts.receivers} receivers, ${counts.bankAccounts} bank accounts, ${counts.blockchainWallets} blockchain wallets`,
      'Pre-seeded data',
    )

    logger.info(`Webhook signing secret: ${WEBHOOK_SIGNING_SECRET}`)

    if (manual) {
      logger.info('Manual mode enabled - payouts/payins will NOT auto-advance')
      logger.info('Use "blindpay advance payout <id>" to advance manually')
    }

    logger.info(`Running on http://localhost:${port}`)
    if (forwardTo.length > 0) {
      logger.info(`Forwarding webhooks to: ${forwardTo.join(', ')}`)
    }
    console.log()
  }

  const app = createMockServer()
  const server = serve({
    fetch: app.fetch,
    port,
  })

  process.on('SIGINT', () => {
    server.close()
    if (!quiet)
      clack.outro('Server stopped.')
    process.exit(0)
  })
}

function waitForServer(port: number, maxAttempts = 25): Promise<boolean> {
  const baseUrl = `http://localhost:${port}`
  let attempts = 0
  return new Promise((resolve) => {
    const tick = () => {
      attempts++
      fetch(baseUrl)
        .then((r) => {
          if (r.ok)
            return resolve(true)
          if (attempts >= maxAttempts)
            return resolve(false)
          setTimeout(tick, 200)
        })
        .catch(() => {
          if (attempts >= maxAttempts)
            return resolve(false)
          setTimeout(tick, 200)
        })
    }
    tick()
  })
}

export async function runMockServerDetached(options: MockServerOptions) {
  const { port } = options
  const portAvailable = await checkPort(port)
  if (!portAvailable) {
    clack.log.error(`Port ${port} is already in use.`)
    clack.log.info('Either stop the other process or use a different port:')
    clack.log.info(`  blindpay mock --port ${port + 1}`)
    clack.outro('Exiting.')
    process.exit(1)
  }

  const entry = process.argv[1]
  const args = process.argv.slice(2).filter(a => a !== '--detach' && a !== '-D')
  const child = spawn(process.execPath, [entry, ...args], {
    env: { ...process.env, BLINDPAY_MOCK_DETACHED: '1' },
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  const ready = await waitForServer(port)
  if (!ready) {
    clack.log.error('Server did not start in time.')
    try {
      process.kill(child.pid!, 'SIGTERM')
    }
    catch {
      // ignore
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }

  writeServerState({ pid: child.pid!, port })
  clack.log.success(`Mock server running in background on http://localhost:${port} (PID ${child.pid})`)
  clack.log.message('Stop with: blindpay mock stop')
}

export function stopMockServer(): boolean {
  const state = readServerState()
  if (!state) {
    return false
  }
  try {
    process.kill(state.pid, 'SIGTERM')
  }
  catch (e: any) {
    if (e?.code !== 'ESRCH')
      throw e
  }
  removeServerState()
  return true
}
