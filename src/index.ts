import process from 'node:process'
import { Command } from 'commander'
import * as clack from '@clack/prompts'
import { listSchemas, getSchema } from './commands/schema'
import {
  listReceivers,
  getReceiver,
  createReceiver,
  updateReceiver,
  deleteReceiver,
  getReceiverLimits,
  getReceiverLimitsIncreaseRequests,
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
  getQuoteFxRate,
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
  getInstance,
  updateInstance,
  listAvailableRails,
  getAvailableBankDetails,
} from './commands/resources'
import { getConfig, setConfig, clearConfig, getConfigPath } from './utils/config'
import { CLI_VERSION } from './utils/constants'

const program = new Command()

program
  .name('blindpay')
  .description('Blindpay CLI — manage receivers, bank accounts, payouts, payins, and more from the terminal.')
  .version(CLI_VERSION)
  .addHelpText('after', `
Examples:
  $ blindpay config set --api-key <key> --instance-id <id>
  $ blindpay receivers list --json
  $ blindpay payouts list --status processing
  $ blindpay available rails

Documentation: https://github.com/blindpaylabs/blindpay-cli`)

// ── Config ──────────────────────────────────────────────────────────────
const configCmd = program.command('config').description('Configure API credentials')
  .addHelpText('after', `
Examples:
  $ blindpay config set --api-key sk_live_... --instance-id inst_...
  $ blindpay config set --base-url https://api.blindpay.com
  $ blindpay config get
  $ blindpay config clear
  $ blindpay config path`)

configCmd
  .command('set')
  .description('Set API key, instance ID, or base URL')
  .option('--api-key <key>', 'API key (from Blindpay dashboard)')
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
    const mask = (s: string | null) => (!s ? '-' : s.length < 10 ? '***' : `${s.slice(0, 3)}...${s.slice(-4)}`)
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

// ── Receivers ───────────────────────────────────────────────────────────
const receivers = program.command('receivers').description('Manage receivers')
  .addHelpText('after', `
Examples:
  $ blindpay receivers list
  $ blindpay receivers list --json
  $ blindpay receivers get <id>
  $ blindpay receivers create --email user@example.com --name "John Doe" --country US
  $ blindpay receivers create --type business --email biz@co.com --legal-name "Acme Inc"
  $ blindpay receivers update <id> --kyc-status approved
  $ blindpay receivers delete <id>`)

receivers
  .command('list')
  .description('List all receivers')
  .option('--json', 'Output as JSON', false)
  .action(opts => listReceivers(opts))

receivers
  .command('get <id>')
  .description('Get a receiver by ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getReceiver(id, opts))

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
  .action(opts => createReceiver(opts))

receivers
  .command('update <id>')
  .description('Update a receiver')
  .option('--name <name>', 'Full name (individual); splits into first_name and last_name')
  .option('--first-name <name>', 'First name (individual)')
  .option('--last-name <name>', 'Last name (individual)')
  .option('--legal-name <name>', 'Legal name (business)')
  .option('--email <email>', 'Receiver email')
  .option('--country <country>', 'ISO 3166 country code')
  .option('--kyc-status <status>', 'KYC status (verifying, approved, rejected, deprecated)')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => updateReceiver(id, opts))

receivers
  .command('delete <id>')
  .description('Delete a receiver')
  .action(id => deleteReceiver(id))

receivers
  .command('limits <id>')
  .description('Get receiver limits')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getReceiverLimits(id, opts))

receivers
  .command('limits_increase_requests <id>')
  .description('Get receiver limits increase requests')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getReceiverLimitsIncreaseRequests(id, opts))

// ── Bank Accounts ───────────────────────────────────────────────────────
const bankAccounts = program.command('bank_accounts').description('Manage bank accounts')
  .addHelpText('after', `
Examples:
  $ blindpay bank_accounts list --receiver-id <id>
  $ blindpay bank_accounts get <id> --receiver-id <receiver-id>
  $ blindpay bank_accounts create --receiver-id <id> --type ach --routing-number 021000021 --account-number 123456789
  $ blindpay bank_accounts create --receiver-id <id> --type pix --pix-key user@email.com
  $ blindpay bank_accounts delete <id> --receiver-id <receiver-id>`)

bankAccounts
  .command('list')
  .description('List bank accounts for a receiver')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listBankAccounts(opts))

bankAccounts
  .command('get <id>')
  .description('Get a bank account by ID')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getBankAccount(id, opts))

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
  .option('--recipient-relationship <rel>', 'Recipient relationship')
  .option('--country <country>', 'Country code')
  .option('--json', 'Output as JSON', false)
  .action(opts => createBankAccount(opts))

bankAccounts
  .command('delete <id>')
  .description('Delete a bank account')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .action((id, opts) => deleteBankAccount(id, opts))

// ── Blockchain Wallets ──────────────────────────────────────────────────
const blockchainWallets = program.command('blockchain_wallets').description('Manage blockchain wallets')
  .addHelpText('after', `
Examples:
  $ blindpay blockchain_wallets list --receiver-id <id>
  $ blindpay blockchain_wallets get <id> --receiver-id <receiver-id>
  $ blindpay blockchain_wallets create --receiver-id <id> --address 0x... --network base
  $ blindpay blockchain_wallets delete <id> --receiver-id <receiver-id>`)

blockchainWallets
  .command('list')
  .description('List blockchain wallets for a receiver')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listBlockchainWallets(opts))

blockchainWallets
  .command('get <id>')
  .description('Get a blockchain wallet by ID')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getBlockchainWallet(id, opts))

blockchainWallets
  .command('create')
  .description('Create a new blockchain wallet')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .requiredOption('--address <address>', 'Wallet address')
  .option('--network <network>', 'Blockchain network', 'base')
  .option('--external-id <id>', 'External ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => createBlockchainWallet(opts))

blockchainWallets
  .command('delete <id>')
  .description('Delete a blockchain wallet')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .action((id, opts) => deleteBlockchainWallet(id, opts))

// ── Quotes ──────────────────────────────────────────────────────────────
const quotes = program.command('quotes').description('Manage payout quotes')
  .addHelpText('after', `
Examples:
  $ blindpay quotes create --bank-account-id <id> --amount 5000 --network base --token USDC`)

quotes
  .command('create')
  .description('Create a new payout quote')
  .requiredOption('--bank-account-id <id>', 'Bank account ID')
  .option('--network <network>', 'Blockchain network', 'base')
  .option('--token <token>', 'Token (USDC, USDT, USDB)', 'USDC')
  .option('--amount <amount>', 'Amount in cents', '1000')
  .option('--json', 'Output as JSON', false)
  .action(opts => createQuote(opts))

quotes
  .command('fx')
  .description('Get FX rates')
  .option('--from <currency>', 'Source currency')
  .option('--to <currency>', 'Target currency')
  .option('--json', 'Output as JSON', false)
  .action(opts => getQuoteFxRate(opts))

// ── Payouts ─────────────────────────────────────────────────────────────
const payouts = program.command('payouts').description('Manage payouts')
  .addHelpText('after', `
Examples:
  $ blindpay payouts list
  $ blindpay payouts list --status processing --json
  $ blindpay payouts get <id>
  $ blindpay payouts create --quote-id <id> --sender-wallet-address 0x... --network evm`)

payouts
  .command('list')
  .description('List all payouts')
  .option('--status <status>', 'Filter by status (processing, failed, refunded, completed, on_hold)')
  .option('--json', 'Output as JSON', false)
  .action(opts => listPayouts(opts))

payouts
  .command('create')
  .description('Create a payout from a quote')
  .requiredOption('--quote-id <id>', 'Payout quote ID from "blindpay quotes create"')
  .option('--network <network>', 'Network: evm, solana, or stellar', 'evm')
  .requiredOption('--sender-wallet-address <address>', 'Sender wallet address')
  .option('--json', 'Output as JSON', false)
  .action(opts => createPayout(opts))

payouts
  .command('get <id>')
  .description('Get a payout by ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getPayout(id, opts))

// ── Payin Quotes ────────────────────────────────────────────────────────
const payinQuotes = program.command('payin_quotes').description('Manage payin quotes')
  .addHelpText('after', `
Examples:
  $ blindpay payin_quotes create --blockchain-wallet-id <id> --payment-method pix --amount 5000 --currency BRL`)

payinQuotes
  .command('create')
  .description('Create a new payin quote')
  .requiredOption('--blockchain-wallet-id <id>', 'Blockchain wallet ID')
  .requiredOption('--payment-method <method>', 'Payment method (pix, ach, wire, spei, transfers, pse)')
  .option('--amount <amount>', 'Amount in cents', '1000')
  .option('--currency <currency>', 'Currency', 'USD')
  .option('--json', 'Output as JSON', false)
  .action(opts => createPayinQuote(opts))

payinQuotes
  .command('fx')
  .description('Get FX rates')
  .option('--from <currency>', 'Source currency')
  .option('--to <currency>', 'Target currency')
  .option('--json', 'Output as JSON', false)
  .action(opts => getQuoteFxRate(opts))

// ── Payins ──────────────────────────────────────────────────────────────
const payins = program.command('payins').description('Manage payins')
  .addHelpText('after', `
Examples:
  $ blindpay payins list
  $ blindpay payins get <id>
  $ blindpay payins create --payin-quote-id <id> --network evm`)

payins
  .command('create')
  .description('Create a payin from a payin quote')
  .requiredOption('--payin-quote-id <id>', 'Payin quote ID from "blindpay payin_quotes create"')
  .option('--network <network>', 'Network: evm, solana, or stellar', 'evm')
  .option('--external-id <id>', 'External ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => createPayin(opts))

payins
  .command('list')
  .description('List all payins')
  .option('--json', 'Output as JSON', false)
  .action(opts => listPayins(opts))

payins
  .command('get <id>')
  .description('Get a payin by ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getPayin(id, opts))

// ── Webhook Endpoints ───────────────────────────────────────────────────
const webhookEndpoints = program.command('webhook_endpoints').description('Manage webhook endpoints')
  .addHelpText('after', `
Examples:
  $ blindpay webhook_endpoints list
  $ blindpay webhook_endpoints create --url https://example.com/webhook --description "Production"
  $ blindpay webhook_endpoints delete <id>`)

webhookEndpoints
  .command('list')
  .description('List webhook endpoints')
  .option('--json', 'Output as JSON', false)
  .action(opts => listWebhookEndpoints(opts))

webhookEndpoints
  .command('create')
  .description('Create a webhook endpoint')
  .requiredOption('--url <url>', 'Webhook URL')
  .option('--description <desc>', 'Description')
  .option('--json', 'Output as JSON', false)
  .action(opts => createWebhookEndpoint(opts))

webhookEndpoints
  .command('delete <id>')
  .description('Delete a webhook endpoint')
  .action(id => deleteWebhookEndpoint(id))

// ── Partner Fees ────────────────────────────────────────────────────────
const partnerFees = program.command('partner_fees').description('Manage partner fees')
  .addHelpText('after', `
Examples:
  $ blindpay partner_fees list
  $ blindpay partner_fees create --payout-percentage 2.5 --payout-flat 1.00 --evm-wallet 0x...
  $ blindpay partner_fees delete <id>`)

partnerFees
  .command('list')
  .description('List partner fees')
  .option('--json', 'Output as JSON', false)
  .action(opts => listPartnerFees(opts))

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
  .action(opts => createPartnerFee(opts))

partnerFees
  .command('delete <id>')
  .description('Delete a partner fee')
  .action(id => deletePartnerFee(id))

// ── API Keys ────────────────────────────────────────────────────────────
const apiKeys = program.command('api_keys').description('Manage API keys')
  .addHelpText('after', `
Examples:
  $ blindpay api_keys list
  $ blindpay api_keys create --name "Production Key"
  $ blindpay api_keys delete <id>`)

apiKeys
  .command('list')
  .description('List API keys')
  .option('--json', 'Output as JSON', false)
  .action(opts => listApiKeys(opts))

apiKeys
  .command('create')
  .description('Create an API key')
  .option('--name <name>', 'Key name', 'CLI API Key')
  .option('--permission <permission>', 'Permission level')
  .option('--json', 'Output as JSON', false)
  .action(opts => createApiKey(opts))

apiKeys
  .command('delete <id>')
  .description('Delete an API key')
  .action(id => deleteApiKey(id))

// ── Virtual Accounts ────────────────────────────────────────────────────
const virtualAccounts = program.command('virtual_accounts').description('Manage virtual accounts')
  .addHelpText('after', `
Examples:
  $ blindpay virtual_accounts list --receiver-id <id>
  $ blindpay virtual_accounts create --receiver-id <id> --blockchain-wallet-id <wallet-id>`)

virtualAccounts
  .command('list')
  .description('List virtual accounts for a receiver')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listVirtualAccounts(opts))

virtualAccounts
  .command('create')
  .description('Create a virtual account')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .requiredOption('--blockchain-wallet-id <id>', 'Blockchain wallet ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => createVirtualAccount(opts))

// ── Offramp Wallets ─────────────────────────────────────────────────────
const offrampWallets = program.command('offramp_wallets').description('Manage offramp wallets')
  .addHelpText('after', `
Examples:
  $ blindpay offramp_wallets list --receiver-id <id> --bank-account-id <bank-id>`)

offrampWallets
  .command('list')
  .description('List offramp wallets')
  .requiredOption('--receiver-id <id>', 'Receiver ID')
  .requiredOption('--bank-account-id <id>', 'Bank account ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listOfframpWallets(opts))

// ── Instances ──────────────────────────────────────────────────────────
const instances = program.command('instances').description('Manage your instance')
  .addHelpText('after', `
Examples:
  $ blindpay instances get
  $ blindpay instances update --name "My Instance" --webhook-url https://example.com/webhook`)

instances
  .command('get')
  .description('Get instance details')
  .option('--json', 'Output as JSON', false)
  .action(opts => getInstance(opts))

instances
  .command('update')
  .description('Update instance settings')
  .option('--name <name>', 'Instance name')
  .option('--webhook-url <url>', 'Default webhook URL')
  .option('--json', 'Output as JSON', false)
  .action(opts => updateInstance(opts))

// ── Available ───────────────────────────────────────────────────────────
const available = program.command('available').description('Reference data (no API key required)')
  .addHelpText('after', `
Examples:
  $ blindpay available rails
  $ blindpay available rails --json
  $ blindpay available bank_details --rail ach
  $ blindpay available bank_details --rail pix`)

available
  .command('rails')
  .description('List available payment rails')
  .option('--json', 'Output as JSON', false)
  .action(opts => listAvailableRails(opts))

available
  .command('bank_details')
  .description('Show required bank details for a payment rail')
  .requiredOption('--rail <rail>', 'Rail type (ach, wire, pix, pix_safe, spei_bitso, transfers_bitso, ach_cop_bitso, international_swift)')
  .option('--json', 'Output as JSON', false)
  .action(opts => getAvailableBankDetails(opts))

// ── Schema ─────────────────────────────────────────────────────────────
const schema = program.command('schema').description('Introspect CLI resource schemas (JSON output for LLM/automation use)')
  .addHelpText('after', `
Examples:
  $ blindpay schema                              # list all resources
  $ blindpay schema receivers                    # full schema for receivers
  $ blindpay schema bank_accounts                # schema + available rails
  $ blindpay schema bank_accounts --rail ach     # schema + rail-specific fields`)

schema
  .argument('[resource]', 'Resource name (e.g. receivers, payouts, bank_accounts)')
  .option('--rail <rail>', 'Show rail-specific fields (bank_accounts only)')
  .action((resource, opts) => {
    if (!resource) {
      listSchemas()
    }
    else {
      getSchema(resource, opts.rail)
    }
  })

// ── Update ──────────────────────────────────────────────────────────────
program
  .command('update')
  .description('Update the Blindpay CLI to the latest version')
  .action(() => {
    console.log()
    clack.log.message('To update the Blindpay CLI, run:')
    console.log()
    console.log('  npm install -g @blindpay/cli@latest')
    console.log()
    clack.log.message('Or use npx to always run the latest version:')
    console.log()
    console.log('  npx @blindpay/cli@latest <command>')
    console.log()
  })

program.parse(process.argv)
