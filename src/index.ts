#!/usr/bin/env node
import process from 'node:process'
import { Command } from 'commander'
import * as clack from '@clack/prompts'
import { runMockServer, runMockServerDetached, stopMockServer } from './commands/mock'
import { triggerEvent } from './commands/trigger'
import { advanceResource } from './commands/advance'
import {
  listReceivers,
  getReceiver,
  createReceiver,
  updateReceiver,
  deleteReceiver,
  listBankAccounts,
  getBankAccount,
  createBankAccount,
  deleteBankAccount,
  listBlockchainWallets,
  getBlockchainWallet,
  createBlockchainWallet,
  deleteBlockchainWallet,
  listPayouts,
  getPayout,
  createPayout,
  listPayins,
  getPayin,
  createPayin,
  createPayinQuote,
  createQuote,
  listWebhookEndpoints,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listPartnerFees,
  createPartnerFee,
  deletePartnerFee,
  listApiKeys,
  createApiKey,
  deleteApiKey,
  listVirtualAccounts,
  createVirtualAccount,
  listOfframpWallets,
  listAvailableRails,
  getAvailableBankDetails,
  showStatus,
} from './commands/resources'
import { getConfig, setConfig, clearConfig, getConfigPath } from './utils/config'
import { CLI_VERSION } from './utils/constants'

const program = new Command()

function getPort(): number {
  const p = program.opts().port ?? process.env.BLINDPAY_PORT ?? '4242'
  return Number(p)
}

function getMock(): boolean {
  return program.opts().mock === true
}

program
  .name('blindpay')
  .description('BlindPay CLI - manage receivers, bank accounts, payouts, payins, webhooks and more from the terminal. Use with live API (blindpay config set) or local mock server (blindpay mock).')
  .version(CLI_VERSION)
  .option('-p, --port <port>', 'Mock server port (for mock mode)', '4242')
  .option('--mock', 'Use local mock server instead of live API', false)

const mock = program.command('mock').description('Manage the mock server')
mock
  .option('-d, --detach', 'Run server in background', false)
  .option('-p, --port <port>', 'Port to run on', '4242')
  .option('-f, --forward-to <urls...>', 'Forward webhooks to these URLs')
  .option('-m, --manual', 'Manual lifecycle mode (no auto-advancement)', false)
  .option('--delay <ms>', 'Delay between lifecycle stages in ms', '2000')
  .action((opts) => {
    const mockOpts = {
      port: Number(opts.port),
      forwardTo: opts.forwardTo || [],
      manual: opts.manual,
      delay: Number(opts.delay),
    }
    if (process.env.BLINDPAY_MOCK_DETACHED === '1') {
      runMockServer({ ...mockOpts, quiet: true })
    }
    else if (opts.detach) {
      runMockServerDetached(mockOpts)
    }
    else {
      runMockServer(mockOpts)
    }
  })

mock
  .command('stop')
  .description('Stop the running mock server (when started with --detach)')
  .action(() => {
    if (stopMockServer()) {
      console.log('Server stopped.')
    }
    else {
      console.log('No mock server is running.')
    }
  })

program
  .command('trigger <event>')
  .description('Trigger a webhook event (e.g., payout.complete, payin.new)')
  .option('--payout-id <id>', 'Use existing payout ID')
  .option('--payin-id <id>', 'Use existing payin ID')
  .option('--json', 'Output as JSON', false)
  .action((event, opts) => {
    triggerEvent(event, { payoutId: opts.payoutId, payinId: opts.payinId, json: opts.json, port: getPort() })
  })

program
  .command('advance <resource> <id>')
  .description('Advance a payout or payin to the next lifecycle stage')
  .option('--to <status>', 'Advance to a specific status (processing, completed, failed)')
  .option('--json', 'Output as JSON', false)
  .action((resource, id, opts) => {
    advanceResource(resource, id, { to: opts.to, json: opts.json, port: getPort() })
  })

program
  .command('status')
  .description('Show mock server data counts')
  .option('--json', 'Output as JSON', false)
  .action(opts => showStatus({ ...opts, port: getPort() }))

const configCmd = program.command('config').description('Configure API key and instance (for live API)')
configCmd
  .command('set')
  .description('Set API key and/or instance ID')
  .option('--api-key <key>', 'API key (from BlindPay dashboard)')
  .option('--instance-id <id>', 'Instance ID')
  .option('--base-url <url>', 'API base URL (default: https://api.blindpay.com)')
  .action((opts) => {
    const updates: { api_key?: string, instance_id?: string, base_url?: string } = {}
    if (opts.apiKey !== undefined)
      updates.api_key = opts.apiKey
    if (opts.instanceId !== undefined)
      updates.instance_id = opts.instanceId
    if (opts.baseUrl !== undefined)
      updates.base_url = opts.baseUrl
    if (Object.keys(updates).length === 0) {
      clack.log.error('Provide at least one option: --api-key, --instance-id, or --base-url')
      process.exit(1)
    }
    setConfig(updates)
    clack.log.success('Config updated')
  })
configCmd
  .command('get')
  .description('Show current config (API key masked)')
  .action(() => {
    const c = getConfig()
    const mask = (s: string | null) => (s && s.length > 6 ? `${s.slice(0, 3)}...${s.slice(-4)}` : (s ?? '-'))
    console.log(`  instance_id: ${c.instance_id ?? '-'}`)
    console.log(`  api_key:     ${mask(c.api_key)}`)
    console.log(`  base_url:    ${c.base_url ?? 'https://api.blindpay.com (default)'}`)
  })
configCmd
  .command('clear')
  .description('Remove saved config')
  .action(() => {
    if (clearConfig())
      clack.log.success('Config cleared')
    else
      clack.log.message('No config file found')
  })
configCmd
  .command('path')
  .description('Print config file path')
  .action(() => console.log(getConfigPath()))

const receivers = program.command('receivers').description('Manage receivers')

receivers
  .command('list')
  .description('List all receivers')
  .option('--json', 'Output as JSON', false)
  .action(opts => listReceivers({ ...opts, port: getPort(), mock: getMock() }))

receivers
  .command('get <id>')
  .description('Get a receiver by ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getReceiver(id, { ...opts, port: getPort(), mock: getMock() }))

receivers
  .command('create')
  .description('Create a new receiver')
  .requiredOption('--email <email>', 'Receiver email')
  .option('--type <type>', 'individual or business', 'individual')
  .option('--name <name>', 'Full name (individual); splits into first_name and last_name')
  .option('--first-name <name>', 'First name (individual)')
  .option('--last-name <name>', 'Last name (individual)')
  .option('--legal-name <name>', 'Legal name (business)')
  .option('--country <country>', 'ISO 3166 country code', 'US')
  .option('--tax-id <id>', 'Tax ID')
  .option('--external-id <id>', 'External ID')
  .option('--kyc-status <status>', 'KYC status (verifying, approved, rejected, deprecated)', 'approved')
  .option('--json', 'Output as JSON', false)
  .action(opts => createReceiver({ ...opts, port: getPort(), mock: getMock() }))

receivers
  .command('update <id>')
  .description('Update a receiver (name, kyc_status, etc.)')
  .option('--name <name>', 'Full name (individual); splits into first_name and last_name')
  .option('--first-name <name>', 'First name (individual)')
  .option('--last-name <name>', 'Last name (individual)')
  .option('--legal-name <name>', 'Legal name (business)')
  .option('--email <email>', 'Receiver email')
  .option('--country <country>', 'ISO 3166 country code')
  .option('--kyc-status <status>', 'KYC status (verifying, approved, rejected, deprecated)')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => updateReceiver(id, { ...opts, port: getPort(), mock: getMock() }))

receivers
  .command('delete <id>')
  .description('Delete a receiver')
  .action((id, _opts) => deleteReceiver(id, { port: getPort(), mock: getMock() }))

const bankAccounts = program.command('bank_accounts').description('Manage bank accounts')

bankAccounts
  .command('list')
  .description('List bank accounts')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listBankAccounts({ ...opts, port: getPort(), mock: getMock() }))

bankAccounts
  .command('get <id>')
  .description('Get a bank account by ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getBankAccount(id, { ...opts, port: getPort(), mock: getMock() }))

bankAccounts
  .command('create')
  .description('Create a new bank account')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .option('--type <type>', 'Bank account type (ach, wire, pix, etc.)', 'ach')
  .option('--name <name>', 'Account name')
  .option('--beneficiary-name <name>', 'Beneficiary name')
  .option('--routing-number <number>', 'Routing number')
  .option('--account-number <number>', 'Account number')
  .option('--account-type <type>', 'checking or saving')
  .option('--account-class <class>', 'individual or business')
  .option('--pix-key <key>', 'PIX key')
  .option('--country <country>', 'Country code')
  .option('--json', 'Output as JSON', false)
  .action(opts => createBankAccount({ ...opts, port: getPort(), mock: getMock() }))

bankAccounts
  .command('delete <id>')
  .description('Delete a bank account')
  .action((id, _opts) => deleteBankAccount(id, { port: getPort(), mock: getMock() }))

const blockchainWallets = program.command('blockchain_wallets').description('Manage blockchain wallets')

blockchainWallets
  .command('list')
  .description('List blockchain wallets')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listBlockchainWallets({ ...opts, port: getPort(), mock: getMock() }))

blockchainWallets
  .command('get <id>')
  .description('Get a blockchain wallet by ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getBlockchainWallet(id, { ...opts, port: getPort(), mock: getMock() }))

blockchainWallets
  .command('create')
  .description('Create a new blockchain wallet')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .requiredOption('--address <address>', 'Wallet address')
  .option('--network <network>', 'Blockchain network', 'base')
  .option('--external-id <id>', 'External ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => createBlockchainWallet({ ...opts, port: getPort(), mock: getMock() }))

blockchainWallets
  .command('delete <id>')
  .description('Delete a blockchain wallet')
  .action((id, _opts) => deleteBlockchainWallet(id, { port: getPort(), mock: getMock() }))

const quotes = program.command('quotes').description('Manage payout quotes')

quotes
  .command('create')
  .description('Create a new payout quote')
  .requiredOption('--bank-account-id <id>', 'Bank account ID')
  .option('--network <network>', 'Blockchain network', 'base')
  .option('--token <token>', 'Token (USDC, USDT, USDB)', 'USDC')
  .option('--amount <amount>', 'Amount in cents', '1000')
  .option('--json', 'Output as JSON', false)
  .action(opts => createQuote({ ...opts, port: getPort(), mock: getMock() }))

quotes
  .command('fx')
  .description('Check FX rate')
  .option('--from <token>', 'From token', 'USDC')
  .option('--to <currency>', 'To currency', 'BRL')
  .option('--amount <amount>', 'Amount in cents', '1000')
  .action(async (opts) => {
    const { mockFxRates } = await import('./utils/constants')
    const rate = mockFxRates[opts.to as keyof typeof mockFxRates] || 100
    console.log(`\n  FX Rate: 1 ${opts.from} = ${rate / 100} ${opts.to}\n`)
  })

const payouts = program.command('payouts').description('Manage payouts')

payouts
  .command('list')
  .description('List all payouts')
  .option('--status <status>', 'Filter by status')
  .option('--json', 'Output as JSON', false)
  .action(opts => listPayouts({ ...opts, port: getPort(), mock: getMock() }))

payouts
  .command('create')
  .description('Create a payout from a quote')
  .requiredOption('--quote-id <id>', 'Payout quote ID from blindpay quotes create')
  .option('--network <network>', 'Network: evm, solana, stellar', 'evm')
  .option('--sender-wallet-address <address>', 'Sender wallet address', '0x0000000000000000000000000000000000000000')
  .option('--json', 'Output as JSON', false)
  .action(opts => createPayout({ ...opts, port: getPort(), mock: getMock() }))

payouts
  .command('get <id>')
  .description('Get a payout by ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getPayout(id, { ...opts, port: getPort(), mock: getMock() }))

const payinQuotes = program.command('payin_quotes').description('Manage payin quotes')
payinQuotes
  .command('create')
  .description('Create a new payin quote')
  .requiredOption('--blockchain-wallet-id <id>', 'Blockchain wallet ID')
  .requiredOption('--payment-method <method>', 'Payment method (pix, ach, wire, spei, transfers, pse)')
  .option('--amount <amount>', 'Amount in cents', '1000')
  .option('--currency <currency>', 'Currency', 'USD')
  .option('--json', 'Output as JSON', false)
  .action(opts => createPayinQuote({ ...opts, port: getPort(), mock: getMock() }))

const payins = program.command('payins').description('Manage payins')

payins
  .command('create')
  .description('Create a payin from a payin quote')
  .requiredOption('--payin-quote-id <id>', 'Payin quote ID from blindpay payin_quotes create')
  .option('--network <network>', 'Network: evm, solana, stellar', 'evm')
  .option('--external-id <id>', 'External ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => createPayin({ ...opts, port: getPort(), mock: getMock() }))

payins
  .command('list')
  .description('List all payins')
  .option('--json', 'Output as JSON', false)
  .action(opts => listPayins({ ...opts, port: getPort(), mock: getMock() }))

payins
  .command('get <id>')
  .description('Get a payin by ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getPayin(id, { ...opts, port: getPort(), mock: getMock() }))

const webhookEndpoints = program.command('webhook_endpoints').description('Manage webhook endpoints')

webhookEndpoints
  .command('list')
  .description('List webhook endpoints')
  .option('--json', 'Output as JSON', false)
  .action(opts => listWebhookEndpoints({ ...opts, port: getPort(), mock: getMock() }))

webhookEndpoints
  .command('create')
  .description('Create a webhook endpoint')
  .requiredOption('--url <url>', 'Webhook URL')
  .option('--description <desc>', 'Description')
  .option('--json', 'Output as JSON', false)
  .action(opts => createWebhookEndpoint({ ...opts, port: getPort(), mock: getMock() }))

webhookEndpoints
  .command('delete <id>')
  .description('Delete a webhook endpoint')
  .action((id, _opts) => deleteWebhookEndpoint(id, { port: getPort(), mock: getMock() }))

const partnerFees = program.command('partner_fees').description('Manage partner fees')

partnerFees
  .command('list')
  .description('List partner fees')
  .option('--json', 'Output as JSON', false)
  .action(opts => listPartnerFees({ ...opts, port: getPort(), mock: getMock() }))

partnerFees
  .command('create')
  .description('Create a partner fee')
  .option('--payout-percentage <pct>', 'Payout percentage fee')
  .option('--payout-flat <amount>', 'Payout flat fee')
  .option('--payin-percentage <pct>', 'Payin percentage fee')
  .option('--payin-flat <amount>', 'Payin flat fee')
  .option('--evm-wallet <address>', 'EVM wallet address')
  .option('--stellar-wallet <address>', 'Stellar wallet address')
  .option('--json', 'Output as JSON', false)
  .action(opts => createPartnerFee({ ...opts, port: getPort(), mock: getMock() }))

partnerFees
  .command('delete <id>')
  .description('Delete a partner fee')
  .action((id, _opts) => deletePartnerFee(id, { port: getPort(), mock: getMock() }))

const apiKeys = program.command('api_keys').description('Manage API keys')

apiKeys
  .command('list')
  .description('List API keys')
  .option('--json', 'Output as JSON', false)
  .action(opts => listApiKeys({ ...opts, port: getPort(), mock: getMock() }))

apiKeys
  .command('create')
  .description('Create an API key')
  .option('--name <name>', 'Key name (e.g. "CLI API Key")')
  .option('--json', 'Output as JSON', false)
  .action(opts => createApiKey({ ...opts, port: getPort(), mock: getMock() }))

apiKeys
  .command('delete <id>')
  .description('Delete an API key')
  .action((id, _opts) => deleteApiKey(id, { port: getPort(), mock: getMock() }))

const virtualAccounts = program.command('virtual_accounts').description('Manage virtual accounts')

virtualAccounts
  .command('list')
  .description('List virtual accounts')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listVirtualAccounts({ ...opts, port: getPort(), mock: getMock() }))

virtualAccounts
  .command('create')
  .description('Create a virtual account')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .requiredOption('--blockchain-wallet-id <id>', 'Blockchain wallet ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => createVirtualAccount({ ...opts, port: getPort(), mock: getMock() }))

const offrampWallets = program.command('offramp_wallets').description('Manage offramp wallets')

offrampWallets
  .command('list')
  .description('List offramp wallets')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .requiredOption('--bank-account-id <id>', 'Bank account ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listOfframpWallets({ ...opts, port: getPort(), mock: getMock() }))

const available = program.command('available').description('Reference data')

available
  .command('rails')
  .description('List available payment rails')
  .option('--json', 'Output as JSON', false)
  .action(opts => listAvailableRails(opts))

available
  .command('bank_details')
  .description('Get required bank details by rail')
  .requiredOption('--rail <rail>', 'Rail type (ach, wire, pix, etc.)')
  .option('--json', 'Output as JSON', false)
  .action(opts => getAvailableBankDetails(opts))

program.parse(process.argv)
