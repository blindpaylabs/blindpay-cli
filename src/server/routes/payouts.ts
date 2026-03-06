import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import { dispatchWebhook } from '../../webhooks/dispatcher'
import { schedulePayoutAdvancement } from '../../lifecycle/index'
import type { Payout } from '../../types'

const app = new Hono()

function buildPayoutOut(payout: Payout) {
  const quote = store.quotes.get(payout.quote_id)
  return {
    id: payout.id,
    status: payout.status,
    sender_wallet_address: payout.sender_wallet_address,
    billing_fee_amount: quote?.billing_fee_amount ?? null,
    transaction_fee_amount: quote?.transaction_fee_amount ?? null,
    partner_fee: payout.partner_fee,
    tracking_complete: payout.tracking_complete,
    tracking_payment: payout.tracking_payment,
    tracking_transaction: payout.tracking_transaction,
    tracking_partner_fee: payout.tracking_partner_fee,
    tracking_liquidity: payout.tracking_liquidity,
    tracking_documents: payout.tracking_documents,
    receiver_id: quote ? (store.bankAccounts.get(quote.bank_account_id)?.receiver_id ?? null) : null,
    bank_account_id: quote?.bank_account_id ?? null,
    offramp_wallet_id: null,
  }
}

function buildGetPayoutOut(payout: Payout) {
  const quote = store.quotes.get(payout.quote_id)
  const bankAccount = quote ? store.bankAccounts.get(quote.bank_account_id) : null
  const receiver = bankAccount ? store.receivers.get(bankAccount.receiver_id) : null

  return {
    ...payout,
    receiver_id: bankAccount?.receiver_id ?? null,
    image_url: receiver?.image_url ?? null,
    first_name: receiver?.first_name ?? null,
    last_name: receiver?.last_name ?? null,
    legal_name: receiver?.legal_name ?? null,
    network: quote?.network ?? null,
    token: quote?.token ?? null,
    description: quote?.description ?? null,
    sender_amount: quote?.sender_amount ?? null,
    receiver_amount: quote?.receiver_amount ?? null,
    partner_fee_amount: quote?.partner_fee_amount ?? null,
    commercial_quotation: quote?.commercial_quotation ?? null,
    blindpay_quotation: quote?.blindpay_quotation ?? null,
    total_fee_amount: quote?.total_fee_amount ?? null,
    receiver_local_amount: quote?.receiver_local_amount ?? null,
    currency: quote?.currency ?? null,
    transaction_document_file: quote?.transaction_document_file ?? null,
    transaction_document_type: quote?.transaction_document_type ?? null,
    transaction_document_id: quote?.transaction_document_id ?? null,
    name: bankAccount?.name ?? null,
    type: bankAccount?.type ?? null,
    pix_key: bankAccount?.pix_key ?? null,
    pix_safe_bank_code: bankAccount?.pix_safe_bank_code ?? null,
    pix_safe_branch_code: bankAccount?.pix_safe_branch_code ?? null,
    pix_safe_cpf_cnpj: bankAccount?.pix_safe_cpf_cnpj ?? null,
    account_number: bankAccount?.account_number ?? null,
    routing_number: bankAccount?.routing_number ?? null,
    country: bankAccount?.country ?? null,
    account_class: bankAccount?.account_class ?? null,
    address_line_1: bankAccount?.address_line_1 ?? null,
    address_line_2: bankAccount?.address_line_2 ?? null,
    city: bankAccount?.city ?? null,
    state_province_region: bankAccount?.state_province_region ?? null,
    postal_code: bankAccount?.postal_code ?? null,
    account_type: bankAccount?.account_type ?? null,
    beneficiary_name: bankAccount?.beneficiary_name ?? null,
    spei_clabe: bankAccount?.spei_clabe ?? null,
    spei_protocol: bankAccount?.spei_protocol ?? null,
    spei_institution_code: bankAccount?.spei_institution_code ?? null,
    swift_code_bic: bankAccount?.swift_code_bic ?? null,
    swift_account_holder_name: bankAccount?.swift_account_holder_name ?? null,
    swift_account_number_iban: bankAccount?.swift_account_number_iban ?? null,
    swift_beneficiary_country: bankAccount?.swift_beneficiary_country ?? null,
    ach_cop_beneficiary_first_name: bankAccount?.ach_cop_beneficiary_first_name ?? null,
    ach_cop_beneficiary_last_name: bankAccount?.ach_cop_beneficiary_last_name ?? null,
    ach_cop_document_id: bankAccount?.ach_cop_document_id ?? null,
    ach_cop_document_type: bankAccount?.ach_cop_document_type ?? null,
    ach_cop_email: bankAccount?.ach_cop_email ?? null,
    ach_cop_bank_code: bankAccount?.ach_cop_bank_code ?? null,
    ach_cop_bank_account: bankAccount?.ach_cop_bank_account ?? null,
    transfers_account: bankAccount?.transfers_account ?? null,
    transfers_type: bankAccount?.transfers_type ?? null,
    has_virtual_account: false,
  }
}

function createPayout(body: any, instanceId: string): Payout {
  const now = new Date().toISOString()
  return {
    id: generateId('payout'),
    status: 'processing',
    sender_wallet_address: body.sender_wallet_address || '0x0000000000000000000000000000000000000000',
    signed_transaction: body.signed_transaction || null,
    quote_id: body.quote_id,
    instance_id: instanceId,
    partner_fee: 0,
    tracking_transaction: { step: 'processing' },
    tracking_payment: { step: 'processing' },
    tracking_liquidity: null,
    tracking_complete: { step: 'processing' },
    tracking_partner_fee: null,
    tracking_documents: null,
    jpm_track_data: null,
    created_at: now,
    updated_at: now,
  }
}

// List payouts
app.get('/', (c) => {
  const instanceId = param(c, 'instanceId')
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')
  const statusFilter = c.req.query('status')
  const receiverFilter = c.req.query('receiver_id')

  let payouts = store.listByInstance(store.payouts, instanceId)

  if (statusFilter) payouts = payouts.filter(p => p.status === statusFilter)
  if (receiverFilter) {
    payouts = payouts.filter(p => {
      const quote = store.quotes.get(p.quote_id)
      const ba = quote ? store.bankAccounts.get(quote.bank_account_id) : null
      return ba?.receiver_id === receiverFilter
    })
  }

  const result = store.paginate(payouts, limit, offset)
  return c.json({ ...result, data: result.data.map(buildGetPayoutOut) })
})

// Get payout
app.get('/:payoutId', (c) => {
  const payoutId = param(c, 'payoutId')
  const payout = store.payouts.get(payoutId)
  if (!payout) return c.json({ success: false, message: 'Payout not found' }, 404)
  return c.json(buildGetPayoutOut(payout))
})

// Create payout on EVM
app.post('/evm', async (c) => {
  const instanceId = param(c, 'instanceId')
  const body = await c.req.json()

  const quote = store.quotes.get(body.quote_id)
  if (!quote) return c.json({ success: false, message: 'Quote not found' }, 400)

  const payout = createPayout(body, instanceId)
  store.payouts.set(payout.id, payout)

  await dispatchWebhook('payout.new', buildPayoutOut(payout))
  schedulePayoutAdvancement(payout.id)

  return c.json(buildPayoutOut(payout), 201)
})

// Create payout on Solana
app.post('/solana', async (c) => {
  const instanceId = param(c, 'instanceId')
  const body = await c.req.json()

  const quote = store.quotes.get(body.quote_id)
  if (!quote) return c.json({ success: false, message: 'Quote not found' }, 400)

  const payout = createPayout(body, instanceId)
  store.payouts.set(payout.id, payout)

  await dispatchWebhook('payout.new', buildPayoutOut(payout))
  schedulePayoutAdvancement(payout.id)

  return c.json(buildPayoutOut(payout), 201)
})

// Create payout on Stellar
app.post('/stellar', async (c) => {
  const instanceId = param(c, 'instanceId')
  const body = await c.req.json()

  const quote = store.quotes.get(body.quote_id)
  if (!quote) return c.json({ success: false, message: 'Quote not found' }, 400)

  const payout = createPayout(body, instanceId)
  store.payouts.set(payout.id, payout)

  await dispatchWebhook('payout.new', buildPayoutOut(payout))
  schedulePayoutAdvancement(payout.id)

  return c.json(buildPayoutOut(payout), 201)
})

// Authorize on Stellar
app.post('/stellar/authorize', async (c) => {
  return c.json({ success: true })
})

// Submit payout documents
app.post('/:payoutId/documents', async (c) => {
  const payoutId = param(c, 'payoutId')
  const payout = store.payouts.get(payoutId)
  if (!payout) return c.json({ success: false, message: 'Payout not found' }, 404)

  const body = await c.req.json()
  const quote = store.quotes.get(payout.quote_id)
  if (quote) {
    quote.transaction_document_type = body.transaction_document_type || null
    quote.transaction_document_id = body.transaction_document_id || null
    quote.transaction_document_file = body.transaction_document_file || null
    quote.description = body.description || quote.description
    store.quotes.set(quote.id, quote)
  }

  if (payout.tracking_documents) {
    payout.tracking_documents = { ...payout.tracking_documents, step: 'completed', status: 'compliance_reviewing', completed_at: new Date().toISOString() }
    store.payouts.set(payoutId, payout)
  }

  return c.json({ success: true })
})

export default app
