import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import { dispatchWebhook } from '../../webhooks/dispatcher'
import type { BankAccount } from '../../types'

const app = new Hono()

/** Internal provider fields that must not be exposed in API responses */
const BANK_ACCOUNT_INTERNAL_KEYS = ['brex_vendor_id', 'checkbook_account_id', 'checkbook_user_key', 'onemoney_external_account_id'] as const

function buildBankAccountOut(ba: BankAccount) {
  const { receiver_id: _rid, instance_id: _iid, ...rest } = ba
  const out: Record<string, unknown> = { ...rest, offramp_wallets: [] }
  BANK_ACCOUNT_INTERNAL_KEYS.forEach(k => delete out[k])
  return out
}

// List bank accounts for a receiver
app.get('/', (c) => {
  const instanceId = param(c, 'instanceId')
  const receiverId = param(c, 'receiverId')
  const accounts = store.listByInstanceAndReceiver(store.bankAccounts, instanceId, receiverId)
  return c.json({ data: accounts.map(buildBankAccountOut), has_more: false, next_page: null, prev_page: null })
})

// Get bank account
app.get('/:bankAccountId', (c) => {
  const bankAccountId = param(c, 'bankAccountId')
  const ba = store.bankAccounts.get(bankAccountId)
  if (!ba) return c.json({ success: false, message: 'Bank account not found' }, 404)
  return c.json(buildBankAccountOut(ba))
})

// Create bank account
app.post('/', async (c) => {
  const instanceId = param(c, 'instanceId')
  const receiverId = param(c, 'receiverId')
  const body = await c.req.json()
  const now = new Date().toISOString()

  const ba: BankAccount = {
    id: generateId('bankAccount'),
    type: body.type || 'ach',
    name: body.name || 'New Bank Account',
    status: 'approved',
    recipient_relationship: body.recipient_relationship || null,
    pix_key: body.pix_key || null,
    beneficiary_name: body.beneficiary_name || null,
    routing_number: body.routing_number || null,
    account_number: body.account_number || null,
    account_type: body.account_type || null,
    account_class: body.account_class || null,
    address_line_1: body.address_line_1 || null,
    address_line_2: body.address_line_2 || null,
    city: body.city || null,
    state_province_region: body.state_province_region || null,
    country: body.country || null,
    postal_code: body.postal_code || null,
    spei_protocol: body.spei_protocol || null,
    spei_clabe: body.spei_clabe || null,
    spei_institution_code: body.spei_institution_code || null,
    transfers_type: body.transfers_type || null,
    transfers_account: body.transfers_account || null,
    ach_cop_beneficiary_first_name: body.ach_cop_beneficiary_first_name || null,
    ach_cop_beneficiary_last_name: body.ach_cop_beneficiary_last_name || null,
    ach_cop_document_id: body.ach_cop_document_id || null,
    ach_cop_document_type: body.ach_cop_document_type || null,
    ach_cop_email: body.ach_cop_email || null,
    ach_cop_bank_code: body.ach_cop_bank_code || null,
    ach_cop_bank_account: body.ach_cop_bank_account || null,
    swift_code_bic: body.swift_code_bic || null,
    swift_account_holder_name: body.swift_account_holder_name || null,
    swift_account_number_iban: body.swift_account_number_iban || null,
    swift_beneficiary_address_line_1: body.swift_beneficiary_address_line_1 || null,
    swift_beneficiary_address_line_2: body.swift_beneficiary_address_line_2 || null,
    swift_beneficiary_country: body.swift_beneficiary_country || null,
    swift_beneficiary_city: body.swift_beneficiary_city || null,
    swift_beneficiary_state_province_region: body.swift_beneficiary_state_province_region || null,
    swift_beneficiary_postal_code: body.swift_beneficiary_postal_code || null,
    swift_bank_name: body.swift_bank_name || null,
    swift_bank_address_line_1: body.swift_bank_address_line_1 || null,
    swift_bank_address_line_2: body.swift_bank_address_line_2 || null,
    swift_bank_country: body.swift_bank_country || null,
    swift_bank_city: body.swift_bank_city || null,
    swift_bank_state_province_region: body.swift_bank_state_province_region || null,
    swift_bank_postal_code: body.swift_bank_postal_code || null,
    swift_intermediary_bank_swift_code_bic: body.swift_intermediary_bank_swift_code_bic || null,
    swift_intermediary_bank_account_number_iban: body.swift_intermediary_bank_account_number_iban || null,
    swift_intermediary_bank_name: body.swift_intermediary_bank_name || null,
    swift_intermediary_bank_country: body.swift_intermediary_bank_country || null,
    pix_safe_bank_code: body.pix_safe_bank_code || null,
    pix_safe_branch_code: body.pix_safe_branch_code || null,
    pix_safe_cpf_cnpj: body.pix_safe_cpf_cnpj || null,
    tron_wallet_hash: body.tron_wallet_hash || null,
    swift_payment_code: body.swift_payment_code || null,
    receiver_id: receiverId,
    instance_id: instanceId,
    created_at: now,
    updated_at: now,
  }

  store.bankAccounts.set(ba.id, ba)
  await dispatchWebhook('bankAccount.new', buildBankAccountOut(ba))
  return c.json(buildBankAccountOut(ba), 201)
})

// Delete bank account
app.delete('/:bankAccountId', (c) => {
  const bankAccountId = param(c, 'bankAccountId')
  if (!store.bankAccounts.has(bankAccountId)) return c.json({ success: false, message: 'Bank account not found' }, 404)
  store.bankAccounts.delete(bankAccountId)
  return c.json({ success: true })
})

export default app
