import process from 'node:process'
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
let mockResponse: { status: number, body: unknown, contentType?: string | null } = { status: 200, body: {} }
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
    const contentType = mockResponse.contentType === undefined ? 'application/json' : mockResponse.contentType
    const responseBody = contentType === null
      ? ''
      : typeof mockResponse.body === 'string' ? mockResponse.body : JSON.stringify(mockResponse.body)
    const headers: Record<string, string> = {}
    if (contentType !== null) headers['content-type'] = contentType
    return new Response(responseBody, { status: mockResponse.status, headers })
  }) as typeof globalThis.fetch

  originalExit = process.exit
  ;(process as unknown as { exit: (code?: number) => never }).exit = ((code?: number) => {
    throw new Error(`__test_exit__${code ?? 0}`)
  }) as never
}

function teardownTestEnv() {
  consoleSpy.mockRestore()
  globalThis.fetch = originalFetch
  ;(process as unknown as { exit: typeof process.exit }).exit = originalExit
  for (const [k, v] of savedEnv) {
    if (v !== undefined) process.env[k] = v
    else delete process.env[k]
  }
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

describe('Receivers', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listReceivers → GET /receivers', async () => {
    mockResponse.body = { data: [{ id: 're_1', type: 'individual', email: 'a@b.com' }] }
    await resources.listReceivers({ json: true })
    expect(lastCall().method).toBe('GET')
    expect(lastCall().url).toBe(`${BASE}/receivers`)
  })

  test('getReceiver → GET /receivers/:id', async () => {
    mockResponse.body = { id: 're_xyz' }
    await resources.getReceiver('re_xyz', { json: true })
    expect(lastCall().method).toBe('GET')
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz`)
  })

  test('createReceiver → POST /receivers with split name', async () => {
    mockResponse.body = { id: 're_new', type: 'individual' }
    await resources.createReceiver({ email: 'a@b.com', name: 'Jane Doe', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/receivers`)
    expect(lastCall().body).toMatchObject({
      type: 'individual',
      email: 'a@b.com',
      first_name: 'Jane',
      last_name: 'Doe',
      country: 'US',
      kyc_status: 'approved',
    })
  })

  test('updateReceiver → PUT /receivers/:id with only provided fields', async () => {
    mockResponse.body = { id: 're_xyz' }
    await resources.updateReceiver('re_xyz', { email: 'new@b.com', json: true })
    expect(lastCall().method).toBe('PUT')
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz`)
    expect(lastCall().body).toEqual({ email: 'new@b.com' })
  })

  test('deleteReceiver → DELETE /receivers/:id', async () => {
    mockResponse.body = { success: true }
    await resources.deleteReceiver('re_xyz', { json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz`)
  })

  test('getReceiverLimits → GET /limits/receivers/:id (corrected path)', async () => {
    mockResponse.body = { per_transaction: 100 }
    await resources.getReceiverLimits('re_xyz', { json: true })
    expect(lastCall().url).toBe(`${BASE}/limits/receivers/re_xyz`)
  })

  test('getReceiverLimitsIncreaseRequests → GET /receivers/:id/limit-increase (corrected path)', async () => {
    mockResponse.body = []
    await resources.getReceiverLimitsIncreaseRequests('re_xyz', { json: true })
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/limit-increase`)
  })

  test('createReceiverLimitIncrease → POST /receivers/:id/limit-increase with parsed amounts', async () => {
    mockResponse.body = { id: 'rl_new' }
    await resources.createReceiverLimitIncrease('re_xyz', {
      perTransaction: '100000',
      daily: '200000',
      monthly: '1000000',
      supportingDocumentType: 'individual_bank_statement',
      supportingDocumentFile: 'https://example.com/doc.pdf',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/limit-increase`)
    expect(lastCall().body).toEqual({
      per_transaction: 100000,
      daily: 200000,
      monthly: 1000000,
      supporting_document_type: 'individual_bank_statement',
      supporting_document_file: 'https://example.com/doc.pdf',
    })
  })
})

describe('Bank Accounts', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listBankAccounts → GET /receivers/:rid/bank-accounts', async () => {
    mockResponse.body = []
    await resources.listBankAccounts({ receiverId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/bank-accounts`)
  })

  test('getBankAccount → GET /receivers/:rid/bank-accounts/:id', async () => {
    mockResponse.body = { id: 'ba_1' }
    await resources.getBankAccount('ba_1', { receiverId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/bank-accounts/ba_1`)
  })

  test('createBankAccount → POST /receivers/:rid/bank-accounts with snake_case body', async () => {
    mockResponse.body = { id: 'ba_new', type: 'ach' }
    await resources.createBankAccount({
      receiverId: 're_xyz',
      type: 'ach',
      beneficiaryName: 'Jane',
      routingNumber: '021000021',
      accountNumber: '123456789',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/bank-accounts`)
    expect(lastCall().body).toMatchObject({
      type: 'ach',
      beneficiary_name: 'Jane',
      routing_number: '021000021',
      account_number: '123456789',
    })
  })

  test('deleteBankAccount → DELETE', async () => {
    mockResponse.body = { success: true }
    await resources.deleteBankAccount('ba_1', { receiverId: 're_xyz', json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/bank-accounts/ba_1`)
  })
})

describe('Blockchain Wallets', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listBlockchainWallets → GET', async () => {
    mockResponse.body = []
    await resources.listBlockchainWallets({ receiverId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/blockchain-wallets`)
  })

  test('getBlockchainWallet → GET by id', async () => {
    mockResponse.body = { id: 'bw_1' }
    await resources.getBlockchainWallet('bw_1', { receiverId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/blockchain-wallets/bw_1`)
  })

  test('createBlockchainWallet → POST with address + network', async () => {
    mockResponse.body = { id: 'bw_new', network: 'base' }
    await resources.createBlockchainWallet({
      receiverId: 're_xyz',
      address: '0xabc',
      network: 'base',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().body).toMatchObject({ address: '0xabc', network: 'base' })
  })

  test('deleteBlockchainWallet → DELETE', async () => {
    mockResponse.body = { success: true }
    await resources.deleteBlockchainWallet('bw_1', { receiverId: 're_xyz', json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/blockchain-wallets/bw_1`)
  })
})

describe('Payouts', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listPayouts → GET /payouts', async () => {
    mockResponse.body = []
    await resources.listPayouts({ json: true })
    expect(lastCall().url).toBe(`${BASE}/payouts`)
  })

  test('listPayouts with status filter → query string', async () => {
    mockResponse.body = []
    await resources.listPayouts({ json: true, status: 'processing' })
    expect(lastCall().url).toBe(`${BASE}/payouts?status=processing`)
  })

  test('getPayout → GET /payouts/:id', async () => {
    mockResponse.body = { id: 'po_1' }
    await resources.getPayout('po_1', { json: true })
    expect(lastCall().url).toBe(`${BASE}/payouts/po_1`)
  })

  test('createPayout → POST /payouts/evm by default', async () => {
    mockResponse.body = { id: 'po_new' }
    await resources.createPayout({ quoteId: 'qu_1', senderWalletAddress: '0xabc', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/payouts/evm`)
    expect(lastCall().body).toEqual({ quote_id: 'qu_1', sender_wallet_address: '0xabc' })
  })

  test('createPayout with --network solana → /payouts/solana', async () => {
    mockResponse.body = { id: 'po_new' }
    await resources.createPayout({ quoteId: 'qu_1', network: 'solana', senderWalletAddress: 'sol_addr', json: true })
    expect(lastCall().url).toBe(`${BASE}/payouts/solana`)
  })

  test('createPayout with --network stellar → /payouts/stellar', async () => {
    mockResponse.body = { id: 'po_new' }
    await resources.createPayout({ quoteId: 'qu_1', network: 'stellar', senderWalletAddress: 'G...', json: true })
    expect(lastCall().url).toBe(`${BASE}/payouts/stellar`)
  })
})

describe('Payins', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listPayins → GET /payins', async () => {
    mockResponse.body = []
    await resources.listPayins({ json: true })
    expect(lastCall().url).toBe(`${BASE}/payins`)
  })

  test('getPayin → GET /payins/:id', async () => {
    mockResponse.body = { id: 'pi_1' }
    await resources.getPayin('pi_1', { json: true })
    expect(lastCall().url).toBe(`${BASE}/payins/pi_1`)
  })

  test('createPayin → POST /payins/{network} (defaults to evm)', async () => {
    mockResponse.body = { id: 'pi_new', status: 'pending' }
    await resources.createPayin({ payinQuoteId: 'pq_1', externalId: 'ext-1', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/payins/evm`)
    expect(lastCall().body).toEqual({ payin_quote_id: 'pq_1', external_id: 'ext-1' })
  })

  test('createPayin with --network solana → /payins/solana', async () => {
    mockResponse.body = { id: 'pi_new', status: 'pending' }
    await resources.createPayin({ payinQuoteId: 'pq_1', network: 'solana', json: true })
    expect(lastCall().url).toBe(`${BASE}/payins/solana`)
  })

  test('createPayinQuote → POST /payin-quotes', async () => {
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
    expect(lastCall().body).toMatchObject({
      blockchain_wallet_id: 'bw_1',
      payment_method: 'pix',
      currency: 'BRL',
    })
  })
})

describe('Quotes', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('createQuote → POST /quotes with bank_account_id, network, token, request_amount', async () => {
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

  test('getQuoteFxRate → GET /fx-rates with optional query params', async () => {
    mockResponse.body = { rate: 5.05 }
    await resources.getQuoteFxRate({ from: 'USD', to: 'BRL', json: true })
    expect(lastCall().url).toBe(`${BASE}/fx-rates?from=USD&to=BRL`)
  })

  test('getQuoteFxRate without params → no query string', async () => {
    mockResponse.body = {}
    await resources.getQuoteFxRate({ json: true })
    expect(lastCall().url).toBe(`${BASE}/fx-rates`)
  })
})

describe('Webhook Endpoints', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listWebhookEndpoints → GET /webhook-endpoints', async () => {
    mockResponse.body = []
    await resources.listWebhookEndpoints({ json: true })
    expect(lastCall().url).toBe(`${BASE}/webhook-endpoints`)
  })

  test('createWebhookEndpoint → POST with url + description', async () => {
    mockResponse.body = { id: 'we_new' }
    await resources.createWebhookEndpoint({ url: 'https://x.com/hook', description: 'd', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/webhook-endpoints`)
    expect(lastCall().body).toMatchObject({ url: 'https://x.com/hook', description: 'd' })
  })

  test('deleteWebhookEndpoint → DELETE', async () => {
    mockResponse.body = { success: true }
    await resources.deleteWebhookEndpoint('we_1', { json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/webhook-endpoints/we_1`)
  })
})

describe('Partner Fees', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listPartnerFees → GET /partner-fees', async () => {
    mockResponse.body = []
    await resources.listPartnerFees({ json: true })
    expect(lastCall().url).toBe(`${BASE}/partner-fees`)
  })

  test('createPartnerFee → POST with cents-scaled fees and optional wallet addresses', async () => {
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
    expect(lastCall().body).toMatchObject({
      payout_percentage_fee: 250,
      payout_flat_fee: 10000,
      evm_wallet_address: '0xevm',
      stellar_wallet_address: 'Gxyz',
    })
  })

  test('deletePartnerFee → DELETE', async () => {
    mockResponse.body = { success: true }
    await resources.deletePartnerFee('pf_1', { json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/partner-fees/pf_1`)
  })
})

describe('API Keys', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listApiKeys → GET /api-keys', async () => {
    mockResponse.body = []
    await resources.listApiKeys({ json: true })
    expect(lastCall().url).toBe(`${BASE}/api-keys`)
  })

  test('createApiKey → POST', async () => {
    mockResponse.body = { id: 'ak_new', key: 'sk_...' }
    await resources.createApiKey({ name: 'test', permission: 'read', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/api-keys`)
    expect(lastCall().body).toMatchObject({ name: 'test', permission: 'read' })
  })

  test('deleteApiKey → DELETE', async () => {
    mockResponse.body = { success: true }
    await resources.deleteApiKey('ak_1', { json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/api-keys/ak_1`)
  })
})

describe('Virtual Accounts', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listVirtualAccounts → GET by receiver', async () => {
    mockResponse.body = []
    await resources.listVirtualAccounts({ receiverId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/virtual-accounts`)
  })

  test('createVirtualAccount → POST with blockchain_wallet_id', async () => {
    mockResponse.body = { id: 'va_new' }
    await resources.createVirtualAccount({ receiverId: 're_xyz', blockchainWalletId: 'bw_1', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/virtual-accounts`)
    expect(lastCall().body).toMatchObject({ blockchain_wallet_id: 'bw_1' })
  })
})

describe('Offramp Wallets', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listOfframpWallets → GET nested path', async () => {
    mockResponse.body = []
    await resources.listOfframpWallets({ receiverId: 're_xyz', bankAccountId: 'ba_1', json: true })
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/bank-accounts/ba_1/offramp-wallets`)
  })
})

describe('Instances', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('getInstance → GET /instances/{id}', async () => {
    mockResponse.body = { id: 'in_testInstance' }
    await resources.getInstance({ json: true })
    expect(lastCall().url).toBe(`${BASE}`)
  })

  test('listInstanceMembers → GET /members', async () => {
    mockResponse.body = []
    await resources.listInstanceMembers({ json: true })
    expect(lastCall().url).toBe(`${BASE}/members`)
  })

  test('updateInstance → PUT with name', async () => {
    mockResponse.body = { id: 'in_testInstance', name: 'New' }
    await resources.updateInstance({ name: 'New', json: true })
    expect(lastCall().method).toBe('PUT')
    expect(lastCall().url).toBe(`${BASE}`)
    expect(lastCall().body).toEqual({ name: 'New' })
  })
})

describe('Available', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listAvailableRails → GET /available/rails', async () => {
    mockResponse.body = []
    await resources.listAvailableRails({ json: true })
    expect(lastCall().url).toBe(`${BASE}/available/rails`)
  })

  test('getAvailableBankDetails → GET /available/bank-details/:rail', async () => {
    mockResponse.body = {}
    await resources.getAvailableBankDetails({ rail: 'pix', json: true })
    expect(lastCall().url).toBe(`${BASE}/available/bank-details/pix`)
  })
})

describe('Wallets (custodial)', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listWallets → GET /receivers/:rid/wallets', async () => {
    mockResponse.body = []
    await resources.listWallets({ receiverId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/wallets`)
  })

  test('getWallet → GET /receivers/:rid/wallets/:id', async () => {
    mockResponse.body = { id: 'bl_1' }
    await resources.getWallet('bl_1', { receiverId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/wallets/bl_1`)
  })

  test('getWalletBalance → GET /wallets/:id/balance', async () => {
    mockResponse.body = { USDC: { amount: 0 } }
    await resources.getWalletBalance('bl_1', { receiverId: 're_xyz', json: true })
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/wallets/bl_1/balance`)
  })

  test('createWallet → POST with network, name, and optional external_id', async () => {
    mockResponse.body = { id: 'bl_new', network: 'polygon' }
    await resources.createWallet({
      receiverId: 're_xyz',
      network: 'polygon',
      name: 'Main',
      externalId: 'ext-1',
      json: true,
    })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/wallets`)
    expect(lastCall().body).toEqual({ network: 'polygon', name: 'Main', external_id: 'ext-1' })
  })

  test('createWallet without externalId → body omits external_id', async () => {
    mockResponse.body = { id: 'bl_new', network: 'polygon' }
    await resources.createWallet({ receiverId: 're_xyz', network: 'polygon', name: 'Main', json: true })
    expect(lastCall().body).toEqual({ network: 'polygon', name: 'Main' })
  })

  test('deleteWallet → DELETE', async () => {
    mockResponse.body = { success: true }
    await resources.deleteWallet('bl_1', { receiverId: 're_xyz', json: true })
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url).toBe(`${BASE}/receivers/re_xyz/wallets/bl_1`)
  })
})

describe('Transfers', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('listTransfers → GET /transfers', async () => {
    mockResponse.body = { data: [], pagination: {} }
    await resources.listTransfers({ json: true })
    expect(lastCall().url).toBe(`${BASE}/transfers`)
  })

  test('getTransfer → GET /transfers/:id', async () => {
    mockResponse.body = { id: 'tr_1' }
    await resources.getTransfer('tr_1', { json: true })
    expect(lastCall().url).toBe(`${BASE}/transfers/tr_1`)
  })

  test('createTransfer → POST /transfers with transfer_quote_id', async () => {
    mockResponse.body = { id: 'tr_new' }
    await resources.createTransfer({ transferQuoteId: 'tq_1', json: true })
    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe(`${BASE}/transfers`)
    expect(lastCall().body).toEqual({ transfer_quote_id: 'tq_1' })
  })

  test('trackTransfer → GET /v1/e/transfers/:id (instance-less)', async () => {
    mockResponse.body = { id: 'tr_1', status: 'processing' }
    await resources.trackTransfer('tr_1', { json: true })
    expect(lastCall().url).toBe('https://api.blindpay.com/v1/e/transfers/tr_1')
  })
})

describe('Transfer Quotes', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('createTransferQuote → POST /transfer-quotes', async () => {
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

  test('createTransferQuote defaults cover_fees to false when omitted', async () => {
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

  test('getInstanceFees → GET /billing/fees', async () => {
    mockResponse.body = {}
    await resources.getInstanceFees({ json: true })
    expect(lastCall().url).toBe(`${BASE}/billing/fees`)
  })
})

describe('Terms of Service', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('initiateTos → POST /v1/e/instances/{id}/tos', async () => {
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

  test('initiateTos omits optional fields when not provided', async () => {
    mockResponse.body = { url: 'https://...' }
    await resources.initiateTos({ idempotencyKey: 'idem-2', json: true })
    expect(lastCall().body).toEqual({ idempotency_key: 'idem-2' })
  })
})

describe('Upload', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('uploadFile → POST /v1/upload with FormData carrying `file` and `bucket`', async () => {
    const tmpPath = `/tmp/blindpay-cli-upload-test-${Date.now()}.txt`
    await Bun.write(tmpPath, 'hello')

    mockResponse.body = { file_url: 'https://files.blindpay.com/x.txt' }
    await resources.uploadFile({ file: tmpPath, bucket: 'limit_increase', json: true })

    expect(lastCall().method).toBe('POST')
    expect(lastCall().url).toBe('https://api.blindpay.com/v1/upload')
    expect(lastCall().body).toBeInstanceOf(FormData)
    const form = lastCall().body as FormData
    expect(form.get('bucket')).toBe('limit_increase')
    const filePart = form.get('file')
    expect(filePart).toBeInstanceOf(Blob)
  })

  test('uploadFile with instanceId → appends ?instance_id= query param', async () => {
    const tmpPath = `/tmp/blindpay-cli-upload-test-${Date.now()}-2.txt`
    await Bun.write(tmpPath, 'hello')

    mockResponse.body = { file_url: 'https://files.blindpay.com/x.txt' }
    await resources.uploadFile({ file: tmpPath, bucket: 'avatar', instanceId: 'in_override', json: true })

    expect(lastCall().url).toBe('https://api.blindpay.com/v1/upload?instance_id=in_override')
  })
})

describe('Error handling', () => {
  beforeEach(setupTestEnv)
  afterEach(teardownTestEnv)

  test('non-2xx response exits with code 2 and surfaces statusCode + message in --json', async () => {
    mockResponse = { status: 404, body: { message: 'receiver not found', errors: [] } }
    await expect(resources.getReceiver('re_xyz', { json: true })).rejects.toThrow('__test_exit__2')
    expect(lastJsonLog()).toMatchObject({
      error: true,
      exitCode: 2,
      statusCode: 404,
      message: 'receiver not found',
    })
  })

  test('validation errors from the response body are surfaced under validationErrors', async () => {
    mockResponse = {
      status: 400,
      body: {
        message: 'invalid request',
        errors: [{ path: ['email'], message: 'required' }],
      },
    }
    await expect(resources.createReceiver({ email: 'x', json: true })).rejects.toThrow('__test_exit__2')
    expect(lastJsonLog()).toMatchObject({
      error: true,
      exitCode: 2,
      statusCode: 400,
      validationErrors: [{ path: ['email'], message: 'required' }],
    })
  })

  test('client-side validation failure (missing file) exits with code 1, not 2', async () => {
    // Code 1 = client-side error (no statusCode); code 2 = API error (has statusCode).
    await expect(
      resources.uploadFile({ file: '/tmp/blindpay-test-does-not-exist.bin', bucket: 'avatar', json: true }),
    ).rejects.toThrow('__test_exit__1')
  })
})
