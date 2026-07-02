import process from 'node:process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unlink } from 'node:fs/promises'
import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import * as resources from '../commands/resources'

interface FetchCall {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

let fetchCalls: FetchCall[] = []
let consoleLogs: string[] = []
let mockResponse: { status: number, body: unknown } = { status: 200, body: {} }
let tempFiles: string[] = []
let originalFetch: typeof globalThis.fetch
let originalExit: typeof process.exit
let savedEnv: Map<string, string | undefined>
let consoleSpy: ReturnType<typeof spyOn>

const ENV_KEYS = ['BLINDPAY_API_KEY', 'BLINDPAY_INSTANCE_ID', 'BLINDPAY_API_URL', 'XDG_CONFIG_HOME']

function setupTestEnv() {
  savedEnv = new Map()
  for (const k of ENV_KEYS)
    savedEnv.set(k, process.env[k])
  process.env.BLINDPAY_API_KEY = 'sk_test_key_123'
  process.env.BLINDPAY_INSTANCE_ID = 'in_testInstance'
  delete process.env.BLINDPAY_API_URL
  process.env.XDG_CONFIG_HOME = `/tmp/blindpay-cli-test-${Date.now()}`

  consoleLogs = []
  consoleSpy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    consoleLogs.push(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '))
  })

  originalFetch = globalThis.fetch
  fetchCalls = []
  mockResponse = { status: 200, body: {} }
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const method = init.method || 'GET'
    const rawBody = typeof init.body === 'string' ? init.body : undefined
    let parsedBody: unknown
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : (init.body ?? undefined)
    }
    catch {
      parsedBody = rawBody
    }
    fetchCalls.push({
      url: typeof input === 'string' ? input : input.toString(),
      method,
      headers: (init.headers as Record<string, string>) || {},
      body: parsedBody,
    })
    const responseBody = typeof mockResponse.body === 'string'
      ? mockResponse.body
      : JSON.stringify(mockResponse.body)
    return new Response(responseBody, {
      status: mockResponse.status,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof globalThis.fetch

  originalExit = process.exit
  ;(process as unknown as { exit: (code?: number) => never }).exit = ((code?: number) => {
    throw new Error(`__test_exit__${code ?? 0}`)
  }) as never
}

async function teardownTestEnv() {
  consoleSpy.mockRestore()
  globalThis.fetch = originalFetch
  ;(process as unknown as { exit: typeof process.exit }).exit = originalExit
  for (const [k, v] of savedEnv) {
    if (v !== undefined) process.env[k] = v
    else delete process.env[k]
  }
  for (const path of tempFiles) {
    await unlink(path).catch(() => {})
  }
  tempFiles = []
}

async function makeTempFile(name: string, contents = 'hello'): Promise<string> {
  const path = join(tmpdir(), `blindpay-cli-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`)
  await Bun.write(path, contents)
  tempFiles.push(path)
  return path
}

function lastCall(): FetchCall {
  if (fetchCalls.length === 0) throw new Error('fetch was not called')
  return fetchCalls[fetchCalls.length - 1]!
}

// Returns the last JSON object printed via console.log, parsed.
// Useful for asserting the shape of `--json` output (success or error).
function lastJsonLog(): Record<string, unknown> {
  for (let i = consoleLogs.length - 1; i >= 0; i--) {
    const line = consoleLogs[i]!
    if (line.startsWith('{') || line.startsWith('[')) {
      try { return JSON.parse(line) as Record<string, unknown> }
      catch { /* not JSON, keep looking */ }
    }
  }
  throw new Error(`no JSON output found in console.log; logs were: ${JSON.stringify(consoleLogs)}`)
}

const BASE = 'https://api.blindpay.com/v1/instances/in_testInstance'

describe('Customers', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('lists customers', async () => {
    mockResponse.body = { data: [{ id: 're_1', type: 'individual', email: 'a@b.com' }] }
    await resources.listCustomers({ json: true })
    expect(lastCall().method).toBe('GET')
    expect(lastCall().url).toBe(`${BASE}/customers`)
  })

  test('fetches a customer by id', async () => {
    mockResponse.body = { id: 're_xyz' }
    await resources.getCustomer('re_xyz', { json: true })
    expect(lastCall().method).toBe('GET')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz`)
  })

  test('creates a customer with kyc_type, splitting --name into first_name and last_name', async () => {
    mockResponse.body = { id: 're_new', customer_id: 're_new' }
    await resources.createCustomer({ email: 'a@b.com', kycType: 'standard', name: 'Jane Doe', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/customers`)
    expect(lastCall().body).toEqual({
      type: 'individual',
      kyc_type: 'standard',
      email: 'a@b.com',
      tax_id: null,
      first_name: 'Jane',
      last_name: 'Doe',
      legal_name: null,
      country: 'US',
      external_id: null,
    })
  })

  test('updates only the fields explicitly passed via flags', async () => {
    mockResponse.body = { id: 're_xyz' }
    await resources.updateCustomer('re_xyz', { email: 'new@b.com', json: true })
    expect(lastCall().method).toBe('PUT')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz`)
    expect(lastCall().body).toEqual({ email: 'new@b.com' })
  })

  test('deletes a customer by id', async () => {
    mockResponse.body = { success: true }
    await resources.deleteCustomer('re_xyz', { json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz`)
  })

  test('fetches customer limits', async () => {
    mockResponse.body = { per_transaction: 100 }
    await resources.getCustomerLimits('re_xyz', { json: true })
    expect(lastCall().url).toBe(`${BASE}/limits/customers/re_xyz`)
  })

  test('fetches customer limit-increase requests', async () => {
    mockResponse.body = []
    await resources.getCustomerLimitsIncreaseRequests('re_xyz', { json: true })
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/limit-increase`)
  })

  test('creates a limit-increase request with monetary fields parsed as integers', async () => {
    mockResponse.body = { id: 'rl_new' }
    await resources.createCustomerLimitIncrease('re_xyz', {
      perTransaction: '100000',
      daily: '200000',
      monthly: '1000000',
      supportingDocumentType: 'individual_bank_statement',
      supportingDocumentFile: 'https://example.com/doc.pdf',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/limit-increase`)
    expect(lastCall().body).toEqual({
      per_transaction: 100000,
      daily: 200000,
      monthly: 1000000,
      supporting_document_type: 'individual_bank_statement',
      supporting_document_file: 'https://example.com/doc.pdf',
    })
  })

  test('fetches the open RFI for a customer', async () => {
    mockResponse.body = { id: 'rfi_1', status: 'pending' }
    await resources.getCustomerRfi('re_xyz', { json: true })
    expect(lastCall().method).toBe('GET')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/rfi`)
  })

  test('submits an RFI response with --body JSON', async () => {
    mockResponse.body = { success: true }
    await resources.submitCustomerRfi('re_xyz', { body: '{"address":"123 Main St"}', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/rfi`)
    expect(lastCall().body).toEqual({ address: '123 Main St' })
  })
})

describe('Bank Accounts', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('lists bank accounts for a customer', async () => {
    mockResponse.body = []
    await resources.listBankAccounts({ customerId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/bank-accounts`)
  })

  test('fetches a bank account by id', async () => {
    mockResponse.body = { id: 'ba_1' }
    await resources.getBankAccount('ba_1', { customerId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/bank-accounts/ba_1`)
  })

  test('creates a bank account, snake_casing keys and defaulting unset fields to null', async () => {
    mockResponse.body = { id: 'ba_new', type: 'ach' }
    await resources.createBankAccount({
      customerId: 're_xyz',
      type: 'ach',
      beneficiaryName: 'Jane',
      routingNumber: '021000021',
      accountNumber: '123456789',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/bank-accounts`)
    expect(lastCall().body).toEqual({
      type: 'ach',
      name: 'CLI Bank Account',
      recipient_relationship: null,
      pix_key: null,
      beneficiary_name: 'Jane',
      routing_number: '021000021',
      account_number: '123456789',
      account_type: null,
      account_class: null,
      country: null,
      swift_ifsc_branch_code: null,
    })
  })

  test('creates a sepa bank account with the full sepa_beneficiary_* field set', async () => {
    mockResponse.body = { id: 'ba_sepa', type: 'sepa' }
    await resources.createBankAccount({
      customerId: 're_xyz',
      type: 'sepa',
      accountClass: 'individual',
      sepaIban: 'DE89370400440532013000',
      sepaBeneficiaryBic: 'COBADEFFXXX',
      sepaBeneficiaryLegalName: 'Jane Doe',
      sepaBeneficiaryAddressLine1: 'Hauptstrasse 1',
      sepaBeneficiaryAddressLine2: 'Apt 2',
      sepaBeneficiaryCity: 'Berlin',
      sepaBeneficiaryStateProvinceRegion: 'BE',
      sepaBeneficiaryPostalCode: '10115',
      sepaBeneficiaryCountry: 'DE',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/bank-accounts`)
    expect(lastCall().body).toEqual({
      type: 'sepa',
      name: 'CLI Bank Account',
      recipient_relationship: null,
      pix_key: null,
      beneficiary_name: null,
      routing_number: null,
      account_number: null,
      account_type: null,
      account_class: 'individual',
      country: null,
      swift_ifsc_branch_code: null,
      sepa_iban: 'DE89370400440532013000',
      sepa_beneficiary_bic: 'COBADEFFXXX',
      sepa_beneficiary_legal_name: 'Jane Doe',
      sepa_beneficiary_address_line_1: 'Hauptstrasse 1',
      sepa_beneficiary_address_line_2: 'Apt 2',
      sepa_beneficiary_city: 'Berlin',
      sepa_beneficiary_state_province_region: 'BE',
      sepa_beneficiary_postal_code: '10115',
      sepa_beneficiary_country: 'DE',
    })
  })

  test('deletes a bank account', async () => {
    mockResponse.body = { success: true }
    await resources.deleteBankAccount('ba_1', { customerId: 're_xyz', json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/bank-accounts/ba_1`)
  })
})

describe('Blockchain Wallets', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('lists blockchain wallets for a customer', async () => {
    mockResponse.body = []
    await resources.listBlockchainWallets({ customerId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/blockchain-wallets`)
  })

  test('fetches a blockchain wallet by id', async () => {
    mockResponse.body = { id: 'bw_1' }
    await resources.getBlockchainWallet('bw_1', { customerId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/blockchain-wallets/bw_1`)
  })

  test('creates a blockchain wallet for a customer', async () => {
    mockResponse.body = { id: 'bw_new', network: 'base' }
    await resources.createBlockchainWallet({
      customerId: 're_xyz',
      address: '0xabc',
      network: 'base',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/blockchain-wallets`)
    expect(lastCall().body).toEqual({
      network: 'base',
      name: 'CLI Blockchain Wallet',
      address: '0xabc',
    })
  })

  test('omits address from body when not provided', async () => {
    mockResponse.body = { id: 'bw_new', network: 'base' }
    await resources.createBlockchainWallet({ customerId: 're_xyz', network: 'base', json: true })
    expect(lastCall().body).toEqual({ network: 'base', name: 'CLI Blockchain Wallet' })
  })

  test('deletes a blockchain wallet', async () => {
    mockResponse.body = { success: true }
    await resources.deleteBlockchainWallet('bw_1', { customerId: 're_xyz', json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/blockchain-wallets/bw_1`)
  })

  test('fetches the sign-message for a customer blockchain wallet', async () => {
    mockResponse.body = { message: 'Sign this: abc123' }
    await resources.getBlockchainWalletSignMessage({ customerId: 're_xyz', json: true })
    expect(lastCall().method).toBe('GET')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/blockchain-wallets/sign-message`)
  })
})

describe('Payouts', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('lists payouts', async () => {
    mockResponse.body = []
    await resources.listPayouts({ json: true })
    expect(lastCall().url).toBe(`${BASE}/payouts`)
  })

  test('filters payouts by --status', async () => {
    mockResponse.body = []
    await resources.listPayouts({ json: true, status: 'processing' })
    expect(lastCall().url).toBe(`${BASE}/payouts?status=processing`)
  })

  test('fetches a payout by id', async () => {
    mockResponse.body = { id: 'po_1' }
    await resources.getPayout('po_1', { json: true })
    expect(lastCall().url).toBe(`${BASE}/payouts/po_1`)
  })

  test('creates an EVM payout by default', async () => {
    mockResponse.body = { id: 'po_new' }
    await resources.createPayout({ quoteId: 'qu_1', senderWalletAddress: '0xabc', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/payouts/evm`)
    expect(lastCall().body).toEqual({ quote_id: 'qu_1', sender_wallet_address: '0xabc' })
  })

  test('routes a Solana payout to /payouts/solana', async () => {
    mockResponse.body = { id: 'po_new' }
    await resources.createPayout({ quoteId: 'qu_1', network: 'solana', senderWalletAddress: 'sol_addr', json: true })
    expect(lastCall().url).toBe(`${BASE}/payouts/solana`)
  })

  test('routes a Stellar payout to /payouts/stellar', async () => {
    mockResponse.body = { id: 'po_new' }
    await resources.createPayout({ quoteId: 'qu_1', network: 'stellar', senderWalletAddress: 'G...', json: true })
    expect(lastCall().url).toBe(`${BASE}/payouts/stellar`)
  })
})

describe('Payins', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('lists payins', async () => {
    mockResponse.body = []
    await resources.listPayins({ json: true })
    expect(lastCall().url).toBe(`${BASE}/payins`)
  })

  test('fetches a payin by id', async () => {
    mockResponse.body = { id: 'pi_1' }
    await resources.getPayin('pi_1', { json: true })
    expect(lastCall().url).toBe(`${BASE}/payins/pi_1`)
  })

  test('creates an EVM payin by default', async () => {
    mockResponse.body = { id: 'pi_new', status: 'pending' }
    await resources.createPayin({ payinQuoteId: 'pq_1', externalId: 'ext-1', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/payins/evm`)
    expect(lastCall().body).toEqual({ payin_quote_id: 'pq_1', external_id: 'ext-1' })
  })

  test('routes a Solana payin to /payins/solana', async () => {
    mockResponse.body = { id: 'pi_new', status: 'pending' }
    await resources.createPayin({ payinQuoteId: 'pq_1', network: 'solana', json: true })
    expect(lastCall().url).toBe(`${BASE}/payins/solana`)
  })

  test('creates a payin quote', async () => {
    mockResponse.body = { id: 'pq_new' }
    await resources.createPayinQuote({
      blockchainWalletId: 'bw_1',
      paymentMethod: 'pix',
      amount: '5000',
      currency: 'BRL',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/payin-quotes`)
    expect(lastCall().body).toEqual({
      blockchain_wallet_id: 'bw_1',
      payment_method: 'pix',
      request_amount: 5000,
      currency: 'BRL',
    })
  })
})

describe('Quotes', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('creates a payout quote with bank account, network, token, and request amount', async () => {
    mockResponse.body = { id: 'qu_new', sender_amount: 0, receiver_amount: 0 }
    await resources.createQuote({
      bankAccountId: 'ba_1',
      network: 'base',
      token: 'USDC',
      amount: '1000',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/quotes`)
    expect(lastCall().body).toEqual({
      bank_account_id: 'ba_1',
      network: 'base',
      token: 'USDC',
      request_amount: 1000,
    })
  })

  test('fetches FX rates with --from/--to passed as query params', async () => {
    mockResponse.body = { rate: 5.05 }
    await resources.getQuoteFxRate({ from: 'USD', to: 'BRL', json: true })
    expect(lastCall().url).toBe(`${BASE}/fx-rates?from=USD&to=BRL`)
  })

  test('fetches FX rates without a query string when --from/--to are absent', async () => {
    mockResponse.body = {}
    await resources.getQuoteFxRate({ json: true })
    expect(lastCall().url).toBe(`${BASE}/fx-rates`)
  })
})

describe('Webhook Endpoints', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('lists webhook endpoints', async () => {
    mockResponse.body = []
    await resources.listWebhookEndpoints({ json: true })
    expect(lastCall().url).toBe(`${BASE}/webhook-endpoints`)
  })

  test('creates a webhook endpoint', async () => {
    mockResponse.body = { id: 'we_new' }
    await resources.createWebhookEndpoint({ url: 'https://x.com/hook', description: 'd', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/webhook-endpoints`)
    expect(lastCall().body).toEqual({ url: 'https://x.com/hook', description: 'd' })
  })

  test('deletes a webhook endpoint', async () => {
    mockResponse.body = { success: true }
    await resources.deleteWebhookEndpoint('we_1', { json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/webhook-endpoints/we_1`)
  })
})

describe('Partner Fees', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('lists partner fees', async () => {
    mockResponse.body = []
    await resources.listPartnerFees({ json: true })
    expect(lastCall().url).toBe(`${BASE}/partner-fees`)
  })

  test('creates a partner fee, cents-scaling percentages and flats and defaulting unset rails to zero', async () => {
    mockResponse.body = { id: 'pf_new' }
    await resources.createPartnerFee({
      payoutPercentage: '2.5',
      payoutFlat: '100',
      evmWallet: '0xevm',
      stellarWallet: 'Gxyz',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/partner-fees`)
    expect(lastCall().body).toEqual({
      name: 'CLI Partner Fee',
      payin_percentage_fee: 0,
      payin_flat_fee: 0,
      payout_percentage_fee: 250,
      payout_flat_fee: 10000,
      evm_wallet_address: '0xevm',
      stellar_wallet_address: 'Gxyz',
    })
  })

  test('deletes a partner fee', async () => {
    mockResponse.body = { success: true }
    await resources.deletePartnerFee('pf_1', { json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/partner-fees/pf_1`)
  })
})

describe('Virtual Accounts', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('lists virtual accounts for a customer', async () => {
    mockResponse.body = []
    await resources.listVirtualAccounts({ customerId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/virtual-accounts`)
  })

  test('creates a virtual account for a customer', async () => {
    mockResponse.body = { id: 'va_new' }
    await resources.createVirtualAccount({
      customerId: 're_xyz',
      bankingPartner: 'jpmorgan',
      token: 'USDC',
      blockchainWalletId: 'bw_1',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/virtual-accounts`)
    expect(lastCall().body).toEqual({
      banking_partner: 'jpmorgan',
      token: 'USDC',
      blockchain_wallet_id: 'bw_1',
    })
  })

  test('fetches a virtual account by id', async () => {
    mockResponse.body = { id: 'va_1' }
    await resources.getVirtualAccount('va_1', { customerId: 're_xyz', json: true })
    expect(lastCall().method).toBe('GET')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/virtual-accounts/va_1`)
  })

  test('updates a virtual account', async () => {
    mockResponse.body = { success: true }
    await resources.updateVirtualAccount('va_1', {
      customerId: 're_xyz',
      token: 'USDT',
      blockchainWalletId: 'bw_2',
      json: true,
    })
    expect(lastCall().method).toBe('PUT')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/virtual-accounts/va_1`)
    expect(lastCall().body).toEqual({ token: 'USDT', blockchain_wallet_id: 'bw_2' })
  })
})

describe('Offramp Wallets', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('lists offramp wallets for a bank account', async () => {
    mockResponse.body = []
    await resources.listOfframpWallets({ customerId: 're_xyz', bankAccountId: 'ba_1', json: true })
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/bank-accounts/ba_1/offramp-wallets`)
  })

  test('creates an offramp wallet', async () => {
    mockResponse.body = { id: 'ow_new', network: 'base', address: '0xabc' }
    await resources.createOfframpWallet({
      customerId: 're_xyz',
      bankAccountId: 'ba_1',
      network: 'base',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/bank-accounts/ba_1/offramp-wallets`)
    expect(lastCall().body).toEqual({ network: 'base' })
  })

  test('creates an offramp wallet with external_id', async () => {
    mockResponse.body = { id: 'ow_new', network: 'base', address: '0xabc' }
    await resources.createOfframpWallet({
      customerId: 're_xyz',
      bankAccountId: 'ba_1',
      network: 'base',
      externalId: 'ext-1',
      json: true,
    })
    expect(lastCall().body).toEqual({ network: 'base', external_id: 'ext-1' })
  })

  test('fetches an offramp wallet by id', async () => {
    mockResponse.body = { id: 'ow_1' }
    await resources.getOfframpWallet('ow_1', { customerId: 're_xyz', bankAccountId: 'ba_1', json: true })
    expect(lastCall().method).toBe('GET')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/bank-accounts/ba_1/offramp-wallets/ow_1`)
  })
})

describe('Instances', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('fetches the current instance', async () => {
    mockResponse.body = { id: 'in_testInstance' }
    await resources.getInstance({ json: true })
    expect(lastCall().url).toBe(`${BASE}`)
  })

  test('lists instance members', async () => {
    mockResponse.body = []
    await resources.listInstanceMembers({ json: true })
    expect(lastCall().url).toBe(`${BASE}/members`)
  })

  test('updates the instance name', async () => {
    mockResponse.body = { id: 'in_testInstance', name: 'New' }
    await resources.updateInstance({ name: 'New', json: true })
    expect(lastCall().method).toBe('PUT')
    expect(lastCall().url).toBe(`${BASE}`)
    expect(lastCall().body).toEqual({ name: 'New' })
  })

  test('migrates instance ownership to a new user', async () => {
    mockResponse.body = { success: true }
    await resources.migrateInstanceOwnership({ userId: 'usr_123', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/ownership`)
    expect(lastCall().body).toEqual({ user_id: 'usr_123' })
  })
})

describe('Available', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('lists available payment rails', async () => {
    mockResponse.body = []
    await resources.listAvailableRails({ json: true })
    expect(lastCall().url).toBe(`${BASE}/available/rails`)
  })

  test('fetches required bank-detail fields for a given rail', async () => {
    mockResponse.body = {}
    await resources.getAvailableBankDetails({ rail: 'pix', json: true })
    expect(lastCall().url).toBe(`${BASE}/available/bank-details/pix`)
  })
})

describe('Wallets (custodial)', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('lists custodial wallets for a customer', async () => {
    mockResponse.body = []
    await resources.listWallets({ customerId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/wallets`)
  })

  test('fetches a custodial wallet by id', async () => {
    mockResponse.body = { id: 'bl_1' }
    await resources.getWallet('bl_1', { customerId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/wallets/bl_1`)
  })

  test('fetches a custodial wallet balance', async () => {
    mockResponse.body = { USDC: { amount: 0 } }
    await resources.getWalletBalance('bl_1', { customerId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/wallets/bl_1/balance`)
  })

  test('creates a custodial wallet with --external-id', async () => {
    mockResponse.body = { id: 'bl_new', network: 'polygon' }
    await resources.createWallet({
      customerId: 're_xyz',
      network: 'polygon',
      name: 'Main',
      externalId: 'ext-1',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/wallets`)
    expect(lastCall().body).toEqual({ network: 'polygon', name: 'Main', external_id: 'ext-1' })
  })

  test('omits external_id from the body when --external-id is not passed', async () => {
    mockResponse.body = { id: 'bl_new', network: 'polygon' }
    await resources.createWallet({ customerId: 're_xyz', network: 'polygon', name: 'Main', json: true })
    expect(lastCall().body).toEqual({ network: 'polygon', name: 'Main' })
  })

  test('deletes a custodial wallet', async () => {
    mockResponse.body = { success: true }
    await resources.deleteWallet('bl_1', { customerId: 're_xyz', json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/customers/re_xyz/wallets/bl_1`)
  })
})

describe('Transfers', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('lists transfers', async () => {
    mockResponse.body = { data: [], pagination: {} }
    await resources.listTransfers({ json: true })
    expect(lastCall().url).toBe(`${BASE}/transfers`)
  })

  test('fetches a transfer by id', async () => {
    mockResponse.body = { id: 'tr_1' }
    await resources.getTransfer('tr_1', { json: true })
    expect(lastCall().url).toBe(`${BASE}/transfers/tr_1`)
  })

  test('creates a transfer from a quote id', async () => {
    mockResponse.body = { id: 'tr_new' }
    await resources.createTransfer({ transferQuoteId: 'tq_1', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/transfers`)
    expect(lastCall().body).toEqual({ transfer_quote_id: 'tq_1' })
  })

  test('tracks a transfer via the public endpoint (no instance scope)', async () => {
    mockResponse.body = { id: 'tr_1', status: 'processing' }
    await resources.trackTransfer('tr_1', { json: true })
    expect(lastCall().url).toBe('https://api.blindpay.com/v1/e/transfers/tr_1')
  })
})

describe('Transfer Quotes', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('creates a transfer quote', async () => {
    mockResponse.body = { id: 'tq_new' }
    await resources.createTransferQuote({
      walletId: 'bl_1',
      senderToken: 'USDC',
      receiverWalletAddress: '0xabc',
      receiverToken: 'USDC',
      receiverNetwork: 'polygon',
      requestAmount: '1000',
      amountReference: 'sender',
      coverFees: true,
      partnerFeeId: 'pf_1',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/transfer-quotes`)
    expect(lastCall().body).toEqual({
      wallet_id: 'bl_1',
      sender_token: 'USDC',
      receiver_wallet_address: '0xabc',
      receiver_token: 'USDC',
      receiver_network: 'polygon',
      request_amount: 1000,
      amount_reference: 'sender',
      cover_fees: true,
      partner_fee_id: 'pf_1',
    })
  })

  test('defaults cover_fees to false when --cover-fees is not passed', async () => {
    mockResponse.body = { id: 'tq_new' }
    await resources.createTransferQuote({
      walletId: 'bl_1',
      senderToken: 'USDC',
      receiverWalletAddress: '0xabc',
      receiverToken: 'USDC',
      receiverNetwork: 'polygon',
      requestAmount: '1000',
      amountReference: 'sender',
      json: true,
    })
    expect((lastCall().body as { cover_fees: boolean }).cover_fees).toBe(false)
  })
})

describe('Fees', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('fetches instance fees', async () => {
    mockResponse.body = {}
    await resources.getInstanceFees({ json: true })
    expect(lastCall().url).toBe(`${BASE}/billing/fees`)
  })
})

describe('Terms of Service', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('initiates a Terms-of-Service flow and returns a hosted URL', async () => {
    mockResponse.body = { url: 'https://app.blindpay.com/e/terms-of-service?...' }
    await resources.initiateTos({
      idempotencyKey: 'idem-1',
      receiverId: 're_xyz',
      redirectUrl: 'https://example.com',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe('https://api.blindpay.com/v1/e/instances/in_testInstance/tos')
    expect(lastCall().body).toEqual({
      idempotency_key: 'idem-1',
      receiver_id: 're_xyz',
      redirect_url: 'https://example.com',
    })
  })

  test('omits receiver_id and redirect_url from the body when not passed', async () => {
    mockResponse.body = { url: 'https://...' }
    await resources.initiateTos({ idempotencyKey: 'idem-2', json: true })
    expect(lastCall().body).toEqual({ idempotency_key: 'idem-2' })
  })
})

describe('Upload', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('uploads a file as multipart/form-data with file + bucket parts', async () => {
    const tmpPath = await makeTempFile('upload.txt')

    mockResponse.body = { file_url: 'https://files.blindpay.com/x.txt' }
    await resources.uploadFile({ file: tmpPath, bucket: 'limit_increase', json: true })

    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe('https://api.blindpay.com/v1/upload')
    expect(lastCall().body).toBeInstanceOf(FormData)
    const form = lastCall().body as FormData
    expect(form.get('bucket')).toBe('limit_increase')
    expect(form.get('file')).toBeInstanceOf(Blob)
  })

  test('appends ?instance_id=… to the upload URL when --instance-id is passed', async () => {
    const tmpPath = await makeTempFile('upload2.txt')

    mockResponse.body = { file_url: 'https://files.blindpay.com/x.txt' }
    await resources.uploadFile({ file: tmpPath, bucket: 'avatar', instanceId: 'in_override', json: true })

    expect(lastCall().url).toBe('https://api.blindpay.com/v1/upload?instance_id=in_override')
  })

  test('analyzes a document via POST /v1/upload/analyze', async () => {
    mockResponse.body = { approval_rate: 'high', description: 'Clear document' }
    await resources.analyzeDocument({ body: '{"file_url":"https://example.com/doc.pdf"}', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe('https://api.blindpay.com/v1/upload/analyze')
    expect(lastCall().body).toEqual({ file_url: 'https://example.com/doc.pdf' })
  })
})

describe('Error handling', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('exits with code 2 and emits a JSON error payload on a non-2xx response', async () => {
    mockResponse = { status: 404, body: { message: 'customer not found', errors: [] } }
    await expect(resources.getCustomer('re_xyz', { json: true })).rejects.toThrow('__test_exit__2')
    expect(lastJsonLog()).toMatchObject({
      error: true,
      exitCode: 2,
      statusCode: 404,
      message: 'customer not found',
    })
  })

  test('surfaces response validation errors under validationErrors', async () => {
    mockResponse = {
      status: 400,
      body: {
        message: 'invalid request',
        errors: [{ path: ['email'], message: 'required' }],
      },
    }
    await expect(resources.createCustomer({ email: 'x', kycType: 'standard', json: true })).rejects.toThrow('__test_exit__2')
    expect(lastJsonLog()).toMatchObject({
      error: true,
      exitCode: 2,
      statusCode: 400,
      validationErrors: [{ path: ['email'], message: 'required' }],
    })
  })

  test('exits with code 1 (not 2) when a client-side check fails before any API call', async () => {
    // Code 1 = client-side error (no statusCode); code 2 = API error (has statusCode).
    // Intentionally NOT created — we want uploadFile to discover it's missing.
    const missing = join(tmpdir(), `blindpay-cli-test-${Date.now()}-does-not-exist.bin`)
    await expect(
      resources.uploadFile({ file: missing, bucket: 'avatar', json: true }),
    ).rejects.toThrow('__test_exit__1')
  })
})
