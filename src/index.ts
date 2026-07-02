import process from 'node:process'
import { Command } from 'commander'
import * as clack from '@clack/prompts'
import { listSchemas, getSchema } from './commands/schema'
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerLimits,
  getCustomerLimitsIncreaseRequests,
  getCustomerRfi,
  submitCustomerRfi,
  listBankAccounts,
  getBankAccount,
  createBankAccount,
  deleteBankAccount,
  listBlockchainWallets,
  getBlockchainWallet,
  createBlockchainWallet,
  deleteBlockchainWallet,
  getBlockchainWalletSignMessage,
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
  listVirtualAccounts,
  createVirtualAccount,
  getVirtualAccount,
  updateVirtualAccount,
  listOfframpWallets,
  createOfframpWallet,
  getOfframpWallet,
  getInstance,
  listInstanceMembers,
  updateInstance,
  migrateInstanceOwnership,
  listAvailableRails,
  getAvailableBankDetails,
  createCustomerLimitIncrease,
  listWallets,
  getWallet,
  getWalletBalance,
  createWallet,
  deleteWallet,
  listTransfers,
  getTransfer,
  createTransfer,
  trackTransfer,
  createTransferQuote,
  getInstanceFees,
  initiateTos,
  uploadFile,
  analyzeDocument,
} from './commands/resources'
import { getConfig, setConfig, clearConfig, getConfigPath } from './utils/config'
import { CLI_VERSION } from './utils/constants'

const program = new Command()

program
  .name('blindpay')
  .description('Blindpay CLI — manage customers, bank accounts, payouts, payins, and more from the terminal.')
  .version(CLI_VERSION)
  .addHelpText('after', `
Examples:
  $ blindpay config set --api-key <key> --instance-id <id>
  $ blindpay customers list --json
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

// ── Customers ────────────────────────────────────────────────────────────
const customers = program.command('customers').description('Manage customers')
  .addHelpText('after', `
Examples:
  $ blindpay customers list
  $ blindpay customers list --json
  $ blindpay customers get <id>
  $ blindpay customers create --email user@example.com --name "John Doe" --country US --kyc-type standard
  $ blindpay customers create --type business --email biz@co.com --legal-name "Acme Inc" --kyc-type light
  $ blindpay customers update <id> --email new@example.com
  $ blindpay customers delete <id>
  $ blindpay customers rfi_get <id>
  $ blindpay customers rfi_submit <id> --body '{"key":"value"}'`)

customers
  .command('list')
  .description('List all customers')
  .option('--json', 'Output as JSON', false)
  .action(opts => listCustomers(opts))

customers
  .command('get <id>')
  .description('Get a customer by ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getCustomer(id, opts))

customers
  .command('create')
  .description('Create a new customer')
  .requiredOption('--email <email>', 'Customer email')
  .requiredOption('--kyc-type <type>', 'KYC type (light, standard, enhanced)')
  .option('--type <type>', 'individual or business', 'individual')
  .option('--name <name>', 'Full name (individual); splits into first_name and last_name')
  .option('--first-name <name>', 'First name (individual)')
  .option('--last-name <name>', 'Last name (individual)')
  .option('--legal-name <name>', 'Legal name (business)')
  .option('--country <country>', 'ISO 3166 country code', 'US')
  .option('--tax-id <id>', 'Tax ID')
  .option('--external-id <id>', 'External ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => createCustomer(opts))

customers
  .command('update <id>')
  .description('Update a customer')
  .option('--name <name>', 'Full name (individual); splits into first_name and last_name')
  .option('--first-name <name>', 'First name (individual)')
  .option('--last-name <name>', 'Last name (individual)')
  .option('--legal-name <name>', 'Legal name (business)')
  .option('--email <email>', 'Customer email')
  .option('--country <country>', 'ISO 3166 country code')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => updateCustomer(id, opts))

customers
  .command('delete <id>')
  .description('Delete a customer')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => deleteCustomer(id, opts))

customers
  .command('limits <id>')
  .description('Get customer limits')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getCustomerLimits(id, opts))

customers
  .command('limits_increase_requests <id>')
  .description('Get customer limit-increase requests')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getCustomerLimitsIncreaseRequests(id, opts))

customers
  .command('create_limit_increase <id>')
  .description('Request a limit increase for a customer')
  .requiredOption('--per-transaction <amount>', 'Per-transaction limit in cents')
  .requiredOption('--daily <amount>', 'Daily limit in cents')
  .requiredOption('--monthly <amount>', 'Monthly limit in cents')
  .requiredOption('--supporting-document-type <type>', 'Supporting document type (individual_bank_statement, individual_tax_return, individual_proof_of_income, business_bank_statement, business_financial_statements, business_tax_return)')
  .requiredOption('--supporting-document-file <url>', 'Supporting document URL (upload via `blindpay upload` first)')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => createCustomerLimitIncrease(id, opts))

customers
  .command('rfi_get <id>')
  .description('Get the open RFI for a customer')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getCustomerRfi(id, opts))

customers
  .command('rfi_submit <id>')
  .description('Submit an RFI response for a customer')
  .requiredOption('--body <json>', 'JSON body (e.g. \'{"address":"..."}\')')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => submitCustomerRfi(id, opts))

// ── Bank Accounts ───────────────────────────────────────────────────────
const bankAccounts = program.command('bank_accounts').description('Manage bank accounts')
  .addHelpText('after', `
Examples:
  $ blindpay bank_accounts list --customer-id <id>
  $ blindpay bank_accounts get <id> --customer-id <customer-id>
  $ blindpay bank_accounts create --customer-id <id> --type ach --routing-number 021000021 --account-number 123456789
  $ blindpay bank_accounts create --customer-id <id> --type pix --pix-key user@email.com
  $ blindpay bank_accounts delete <id> --customer-id <customer-id>`)

bankAccounts
  .command('list')
  .description('List bank accounts for a customer')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listBankAccounts(opts))

bankAccounts
  .command('get <id>')
  .description('Get a bank account by ID')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getBankAccount(id, opts))

bankAccounts
  .command('create')
  .description('Create a new bank account')
  .requiredOption('--customer-id <id>', 'Customer ID')
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
  .option('--swift-ifsc-branch-code <code>', 'SWIFT/IFSC branch code (international_swift accounts)')
  .option('--sepa-iban <iban>', 'IBAN (sepa accounts)')
  .option('--sepa-beneficiary-bic <bic>', 'Beneficiary BIC/SWIFT code (sepa accounts)')
  .option('--sepa-beneficiary-legal-name <name>', 'Beneficiary legal name (sepa accounts)')
  .option('--sepa-beneficiary-address-line-1 <line>', 'Beneficiary address line 1 (sepa accounts)')
  .option('--sepa-beneficiary-address-line-2 <line>', 'Beneficiary address line 2 (sepa accounts)')
  .option('--sepa-beneficiary-city <city>', 'Beneficiary city (sepa accounts)')
  .option('--sepa-beneficiary-state-province-region <region>', 'Beneficiary state/province/region (sepa accounts)')
  .option('--sepa-beneficiary-postal-code <code>', 'Beneficiary postal code (sepa accounts)')
  .option('--sepa-beneficiary-country <country>', 'Beneficiary country code (sepa accounts)')
  .option('--json', 'Output as JSON', false)
  .action(opts => createBankAccount(opts))

bankAccounts
  .command('delete <id>')
  .description('Delete a bank account')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => deleteBankAccount(id, opts))

// ── Blockchain Wallets ──────────────────────────────────────────────────
const blockchainWallets = program.command('blockchain_wallets').description('Manage blockchain wallets')
  .addHelpText('after', `
Examples:
  $ blindpay blockchain_wallets list --customer-id <id>
  $ blindpay blockchain_wallets get <id> --customer-id <customer-id>
  $ blindpay blockchain_wallets create --customer-id <id> --address 0x... --network base
  $ blindpay blockchain_wallets sign_message --customer-id <id>
  $ blindpay blockchain_wallets delete <id> --customer-id <customer-id>`)

blockchainWallets
  .command('list')
  .description('List blockchain wallets for a customer')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listBlockchainWallets(opts))

blockchainWallets
  .command('get <id>')
  .description('Get a blockchain wallet by ID')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getBlockchainWallet(id, opts))

blockchainWallets
  .command('create')
  .description('Create a new blockchain wallet')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--address <address>', 'Wallet address')
  .option('--network <network>', 'Blockchain network', 'base')
  .option('--name <name>', 'Wallet name')
  .option('--signature-tx-hash <hash>', 'Signature transaction hash (for wallet ownership verification)')
  .option('--is-account-abstraction', 'Mark wallet as account abstraction', false)
  .option('--json', 'Output as JSON', false)
  .action(opts => createBlockchainWallet(opts))

blockchainWallets
  .command('sign_message')
  .description('Get the message to sign for blockchain wallet verification')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => getBlockchainWalletSignMessage(opts))

blockchainWallets
  .command('delete <id>')
  .description('Delete a blockchain wallet')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
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
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => deleteWebhookEndpoint(id, opts))

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
  .option('--name <name>', 'Partner fee name')
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
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => deletePartnerFee(id, opts))

// ── Virtual Accounts ────────────────────────────────────────────────────
const virtualAccounts = program.command('virtual_accounts').description('Manage virtual accounts')
  .addHelpText('after', `
Examples:
  $ blindpay virtual_accounts list --customer-id <id>
  $ blindpay virtual_accounts get <id> --customer-id <customer-id>
  $ blindpay virtual_accounts create --customer-id <id> --banking-partner jpmorgan --token USDC --blockchain-wallet-id <wallet-id>
  $ blindpay virtual_accounts update <id> --customer-id <id> --token USDC --blockchain-wallet-id <wallet-id>`)

virtualAccounts
  .command('list')
  .description('List virtual accounts for a customer')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listVirtualAccounts(opts))

virtualAccounts
  .command('get <id>')
  .description('Get a virtual account by ID')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getVirtualAccount(id, opts))

virtualAccounts
  .command('create')
  .description('Create a virtual account')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .requiredOption('--banking-partner <partner>', 'Banking partner (jpmorgan, citi, hsbc, cfsb)')
  .requiredOption('--token <token>', 'Token (USDC, USDT, USDB)')
  .requiredOption('--blockchain-wallet-id <id>', 'Blockchain wallet ID')
  .option('--sole-proprietor-doc-type <type>', 'Sole proprietor document type (master_service_agreement, salary_slip, bank_statement)')
  .option('--sole-proprietor-doc-file <url>', 'Sole proprietor document file URL')
  .option('--json', 'Output as JSON', false)
  .action(opts => createVirtualAccount(opts))

virtualAccounts
  .command('update <id>')
  .description('Update a virtual account')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .requiredOption('--token <token>', 'Token (USDC, USDT, USDB)')
  .requiredOption('--blockchain-wallet-id <id>', 'Blockchain wallet ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => updateVirtualAccount(id, opts))

// ── Offramp Wallets ─────────────────────────────────────────────────────
const offrampWallets = program.command('offramp_wallets').description('Manage offramp wallets')
  .addHelpText('after', `
Examples:
  $ blindpay offramp_wallets list --customer-id <id> --bank-account-id <bank-id>
  $ blindpay offramp_wallets get <id> --customer-id <id> --bank-account-id <bank-id>
  $ blindpay offramp_wallets create --customer-id <id> --bank-account-id <bank-id> --network base`)

offrampWallets
  .command('list')
  .description('List offramp wallets')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .requiredOption('--bank-account-id <id>', 'Bank account ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listOfframpWallets(opts))

offrampWallets
  .command('create')
  .description('Create an offramp wallet')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .requiredOption('--bank-account-id <id>', 'Bank account ID')
  .requiredOption('--network <network>', 'Blockchain network')
  .option('--external-id <id>', 'External ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => createOfframpWallet(opts))

offrampWallets
  .command('get <id>')
  .description('Get an offramp wallet by ID')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .requiredOption('--bank-account-id <id>', 'Bank account ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getOfframpWallet(id, opts))

// ── Instances ──────────────────────────────────────────────────────────
const instances = program.command('instances').description('Manage your instance')
  .addHelpText('after', `
Examples:
  $ blindpay instances get
  $ blindpay instances update --name "My Instance"
  $ blindpay instances migrate_ownership --user-id <id>
  $ blindpay instances members list`)

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

instances
  .command('migrate_ownership')
  .description('Migrate instance ownership to another user')
  .requiredOption('--user-id <id>', 'User ID to transfer ownership to')
  .option('--json', 'Output as JSON', false)
  .action(opts => migrateInstanceOwnership(opts))

const instanceMembers = instances.command('members').description('Manage instance members')

instanceMembers
  .command('list')
  .description('List instance members')
  .option('--json', 'Output as JSON', false)
  .action(opts => listInstanceMembers(opts))

// ── Available ───────────────────────────────────────────────────────────
const available = program.command('available').description('Available payment rails and bank details')
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

// ── Wallets (custodial) ────────────────────────────────────────────────
const wallets = program.command('wallets').description('Manage custodial wallets (BlindPay-managed, with balance)')
  .addHelpText('after', `
Examples:
  $ blindpay wallets list --customer-id <id>
  $ blindpay wallets get <id> --customer-id <customer-id>
  $ blindpay wallets balance <id> --customer-id <customer-id>
  $ blindpay wallets create --customer-id <id> --network polygon --name "Main Wallet"
  $ blindpay wallets delete <id> --customer-id <customer-id>`)

wallets
  .command('list')
  .description('List custodial wallets for a customer')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => listWallets(opts))

wallets
  .command('get <id>')
  .description('Get a custodial wallet by ID')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getWallet(id, opts))

wallets
  .command('balance <id>')
  .description('Get a custodial wallet balance (USDC/USDT/USDB)')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getWalletBalance(id, opts))

wallets
  .command('create')
  .description('Create a new custodial wallet')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .requiredOption('--network <network>', 'Network')
  .requiredOption('--name <name>', 'Wallet name')
  .option('--external-id <id>', 'External ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => createWallet(opts))

wallets
  .command('delete <id>')
  .description('Delete a custodial wallet')
  .requiredOption('--customer-id <id>', 'Customer ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => deleteWallet(id, opts))

// ── Transfers ──────────────────────────────────────────────────────────
const transfers = program.command('transfers').description('Manage transfers (wallet → wallet, cross-chain)')
  .addHelpText('after', `
Examples:
  $ blindpay transfers list
  $ blindpay transfers get <id>
  $ blindpay transfers create --transfer-quote-id <id>
  $ blindpay transfers track <id>`)

transfers
  .command('list')
  .description('List transfers')
  .option('--json', 'Output as JSON', false)
  .action(opts => listTransfers(opts))

transfers
  .command('get <id>')
  .description('Get a transfer by ID')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => getTransfer(id, opts))

transfers
  .command('create')
  .description('Create a transfer from a transfer quote')
  .requiredOption('--transfer-quote-id <id>', 'Transfer quote ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => createTransfer(opts))

transfers
  .command('track <id>')
  .description('Public tracking endpoint for a transfer (no auth required)')
  .option('--json', 'Output as JSON', false)
  .action((id, opts) => trackTransfer(id, opts))

// ── Transfer Quotes ────────────────────────────────────────────────────
const transferQuotes = program.command('transfer_quotes').description('Manage transfer quotes')
  .addHelpText('after', `
Examples:
  $ blindpay transfer_quotes create --wallet-id <id> --sender-token USDC \\
      --receiver-wallet-address 0x... --receiver-token USDC --receiver-network polygon \\
      --request-amount 1000 --amount-reference sender`)

transferQuotes
  .command('create')
  .description('Create a transfer quote')
  .requiredOption('--wallet-id <id>', 'Sender wallet ID (bl_...)')
  .requiredOption('--sender-token <token>', 'Sender token (USDC, USDT, ...)')
  .requiredOption('--receiver-wallet-address <addr>', 'Receiver wallet address')
  .requiredOption('--receiver-token <token>', 'Receiver token')
  .requiredOption('--receiver-network <network>', 'Receiver network')
  .requiredOption('--request-amount <amount>', 'Request amount in cents')
  .requiredOption('--amount-reference <ref>', 'Amount reference (sender or receiver)')
  .option('--cover-fees', 'Sender covers the fees', false)
  .option('--partner-fee-id <id>', 'Partner fee ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => createTransferQuote(opts))

// ── Fees ───────────────────────────────────────────────────────────────
const fees = program.command('fees').description('Inspect instance fees')
  .addHelpText('after', `
Examples:
  $ blindpay fees get
  $ blindpay fees get --json`)

fees
  .command('get')
  .description('Get all fees for the current instance')
  .option('--json', 'Output as JSON', false)
  .action(opts => getInstanceFees(opts))

// ── Terms of Service ───────────────────────────────────────────────────
const tos = program.command('tos').description('Initiate Terms of Service flow')
  .addHelpText('after', `
Examples:
  $ blindpay tos initiate --idempotency-key <key>
  $ blindpay tos initiate --idempotency-key <key> --receiver-id <id> --redirect-url https://example.com`)

tos
  .command('initiate')
  .description('Initiate a Terms of Service session and return a hosted URL')
  .requiredOption('--idempotency-key <key>', 'Idempotency key')
  .option('--receiver-id <id>', 'Receiver ID')
  .option('--redirect-url <url>', 'Redirect URL after acceptance')
  .option('--json', 'Output as JSON', false)
  .action(opts => initiateTos(opts))

// ── Upload ─────────────────────────────────────────────────────────────
const upload = program.command('upload').description('Upload files and analyze documents')
  .addHelpText('after', `
Examples:
  $ blindpay upload file --file ./document.pdf --bucket limit_increase
  $ blindpay upload file --file ./avatar.png --bucket avatar --instance-id <id>
  $ blindpay upload analyze --body '{"file_url":"https://..."}'`)

upload
  .command('file')
  .description('Upload a file (returns a file_url usable in other create commands)')
  .requiredOption('--file <path>', 'Path to the file to upload')
  .requiredOption('--bucket <bucket>', 'Target bucket (avatar, onboarding, limit_increase)')
  .option('--instance-id <id>', 'Override the configured instance ID')
  .option('--json', 'Output as JSON', false)
  .action(opts => uploadFile(opts))

upload
  .command('analyze')
  .description('Analyze a document and get an approval rate prediction')
  .requiredOption('--body <json>', 'JSON body with document details (e.g. \'{"file_url":"..."}\')')
  .option('--json', 'Output as JSON', false)
  .action(opts => analyzeDocument(opts))

// ── Schema ─────────────────────────────────────────────────────────────
const schema = program.command('schema').description('Introspect CLI resource schemas (JSON output for LLM/automation use)')
  .addHelpText('after', `
Examples:
  $ blindpay schema                              # list all resources
  $ blindpay schema customers                    # full schema for customers
  $ blindpay schema bank_accounts                # schema + available rails
  $ blindpay schema bank_accounts --rail ach     # schema + rail-specific fields`)

schema
  .argument('[resource]', 'Resource name (e.g. customers, payouts, bank_accounts)')
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
