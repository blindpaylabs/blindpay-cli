import process from 'node:process'
import * as clack from '@clack/prompts'
import pc from 'picocolors'
import { formatOutput, truncate } from '../utils/output'
import type { ApiContext, ApiError, ValidationErrorItem } from '../utils/api-client'
import { apiGet, apiPost, apiPut, apiDelete, resolveContext } from '../utils/api-client'

function instancePath(ctx: ApiContext) {
  return `/v1/instances/${ctx.instanceId}`
}

function printResult(data: unknown, json: boolean, columns?: string[]) {
  console.log(formatOutput(data, json, columns))
}

function formatValidationError(item: ValidationErrorItem): string {
  const path = Array.isArray(item.path) ? item.path.filter(Boolean).join('.') : ''
  return path ? `${path}: ${item.message}` : item.message
}

function handleApiError(err: unknown, json = false): never {
  const apiErr = err as ApiError
  const statusCode = apiErr.statusCode
  const exitCode = statusCode ? 2 : 1
  const msg = err instanceof Error ? err.message : String(err)

  if (json) {
    const output: Record<string, unknown> = { error: true, message: msg, exitCode }
    if (statusCode) output.statusCode = statusCode
    if (apiErr.validationErrors?.length) output.validationErrors = apiErr.validationErrors
    console.log(JSON.stringify(output, null, 2))
  }
  else {
    clack.log.error(msg)
    if (apiErr.validationErrors?.length) {
      for (const ve of apiErr.validationErrors)
        console.log(pc.dim(`  • ${formatValidationError(ve)}`))
    }
  }
  process.exit(exitCode)
}

function exitWithError(message: string, exitCode: number, json = false): never {
  if (json) {
    console.log(JSON.stringify({ error: true, message, exitCode }, null, 2))
  }
  else {
    clack.log.error(message)
  }
  process.exit(exitCode)
}

function parseAmount(value: string | undefined, fallback: number, json: boolean): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    exitWithError(`Invalid amount: "${value}". Must be a non-negative number (in cents).`, 1, json)
  }
  return Math.round(parsed)
}

function extractList(res: any): any[] {
  if (Array.isArray(res))
    return res
  if (res?.data && Array.isArray(res.data))
    return res.data
  return []
}

// Customers
export async function listCustomers(options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/customers`)
    const list = extractList(res)
    const display = list.map((r: any) => ({
      id: r.id,
      type: r.type,
      name: r.type === 'individual' ? `${r.first_name || ''} ${r.last_name || ''}`.trim() || '-' : r.legal_name || '-',
      email: r.email,
      country: r.country,
      kyc_status: r.kyc_status,
    }))
    printResult(options.json ? list : display, options.json, ['id', 'type', 'name', 'email', 'country', 'kyc_status'])
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function getReceiver(id: string, options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const receiver = await apiGet(ctx, `${instancePath(ctx)}/customers/${id}`)
    printResult(receiver, options.json)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function createReceiver(options: {
  email: string
  type?: string
  name?: string
  firstName?: string
  lastName?: string
  legalName?: string
  country?: string
  taxId?: string
  externalId?: string
  kycStatus?: string
  json: boolean
}) {
  try {
    const ctx = resolveContext()
    let first_name = options.firstName ?? null
    let last_name = options.lastName ?? null
    if (options.name !== null && options.name !== undefined && String(options.name).trim()) {
      const parts = String(options.name).trim().split(/\s+/)
      if (parts.length >= 2) {
        first_name = parts[0]
        last_name = parts.slice(1).join(' ')
      }
      else {
        first_name = parts[0]
        last_name = null
      }
    }
    const body = {
      type: options.type || 'individual',
      email: options.email,
      tax_id: options.taxId ?? null,
      first_name: first_name ?? null,
      last_name: last_name ?? null,
      legal_name: options.legalName ?? null,
      country: options.country || 'US',
      external_id: options.externalId ?? null,
      kyc_status: options.kycStatus ?? 'approved',
    }
    const receiver = await apiPost<{ id: string, type: string }>(ctx, `${instancePath(ctx)}/customers`, body)
    const displayName = body.type === 'business'
      ? (body.legal_name || '—')
      : [body.first_name, body.last_name].filter(Boolean).join(' ').trim() || '—'
    clack.log.success(`Created customer ${receiver.id} (${receiver.type}, ${displayName})`)
    if (options.json)
      console.log(formatOutput(receiver, true))
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function updateReceiver(
  id: string,
  options: {
    name?: string
    firstName?: string
    lastName?: string
    legalName?: string
    email?: string
    country?: string
    kycStatus?: string
    json?: boolean
  },
) {
  try {
    const ctx = resolveContext()
    const body: Record<string, any> = {}
    if (options.firstName !== undefined)
      body.first_name = options.firstName
    if (options.lastName !== undefined)
      body.last_name = options.lastName
    if (options.legalName !== undefined)
      body.legal_name = options.legalName
    if (options.email !== undefined)
      body.email = options.email
    if (options.country !== undefined)
      body.country = options.country
    if (options.kycStatus !== undefined)
      body.kyc_status = options.kycStatus
    if (options.name !== undefined && options.name.trim()) {
      const parts = options.name.trim().split(/\s+/)
      if (parts.length >= 2) {
        body.first_name = parts[0]
        body.last_name = parts.slice(1).join(' ')
      }
      else {
        body.first_name = parts[0]
        body.last_name = null
      }
    }
    if (Object.keys(body).length === 0) {
      exitWithError('Provide at least one field to update (e.g. --name, --kyc-status)', 1, options.json)
    }
    const receiver = await apiPut<Record<string, any>>(ctx, `${instancePath(ctx)}/customers/${id}`, body)
    clack.log.success(`Updated customer ${id}`)
    if (options.json)
      console.log(formatOutput(receiver, true))
    else
      console.log(formatOutput(receiver, false))
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function deleteReceiver(id: string, options: { json?: boolean } = {}) {
  try {
    const ctx = resolveContext()
    await apiDelete(ctx, `${instancePath(ctx)}/customers/${id}`)
    clack.log.success(`Deleted customer ${id}`)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Bank Accounts
export async function listBankAccounts(options: { receiverId: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/customers/${options.receiverId}/bank-accounts`)
    const list = extractList(res)
    const display = list.map((a: any) => ({ id: a.id, type: a.type, name: a.name, status: a.status, country: a.country }))
    printResult(options.json ? list : display, options.json, ['id', 'type', 'name', 'status', 'country'])
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function getBankAccount(id: string, options: { receiverId: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const account = await apiGet(ctx, `${instancePath(ctx)}/customers/${options.receiverId}/bank-accounts/${id}`)
    printResult(account, options.json)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function createBankAccount(options: {
  receiverId: string
  type?: string
  name?: string
  recipientRelationship?: string
  pixKey?: string
  beneficiaryName?: string
  routingNumber?: string
  accountNumber?: string
  accountType?: string
  accountClass?: string
  country?: string
  json: boolean
}) {
  try {
    const ctx = resolveContext()
    const body = {
      type: options.type || 'ach',
      name: options.name || 'CLI Bank Account',
      recipient_relationship: options.recipientRelationship ?? null,
      pix_key: options.pixKey ?? null,
      beneficiary_name: options.beneficiaryName ?? null,
      routing_number: options.routingNumber ?? null,
      account_number: options.accountNumber ?? null,
      account_type: options.accountType ?? null,
      account_class: options.accountClass ?? null,
      country: options.country ?? null,
    }
    const ba = await apiPost<{ id: string, type: string }>(ctx, `${instancePath(ctx)}/customers/${options.receiverId}/bank-accounts`, body)
    clack.log.success(`Created bank account ${ba.id} (${ba.type})`)
    if (options.json)
      console.log(formatOutput(ba, true))
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function deleteBankAccount(id: string, options: { receiverId: string, json?: boolean }) {
  try {
    const ctx = resolveContext()
    await apiDelete(ctx, `${instancePath(ctx)}/customers/${options.receiverId}/bank-accounts/${id}`)
    clack.log.success(`Deleted bank account ${id}`)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Blockchain Wallets
export async function listBlockchainWallets(options: { receiverId: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/customers/${options.receiverId}/blockchain-wallets`)
    const list = extractList(res)
    const display = list.map((w: any) => ({ id: w.id, address: truncate(w.address, 20), network: w.network }))
    printResult(options.json ? list : display, options.json, ['id', 'address', 'network'])
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function getBlockchainWallet(id: string, options: { receiverId: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const wallet = await apiGet(ctx, `${instancePath(ctx)}/customers/${options.receiverId}/blockchain-wallets/${id}`)
    printResult(wallet, options.json)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function createBlockchainWallet(options: {
  receiverId: string
  address: string
  network?: string
  name?: string
  externalId?: string
  json: boolean
}) {
  try {
    const ctx = resolveContext()
    const body = {
      address: options.address,
      network: options.network || 'base',
      name: options.name || 'CLI Blockchain Wallet',
      external_id: options.externalId ?? null,
    }
    const wallet = await apiPost<{ id: string, network: string }>(ctx, `${instancePath(ctx)}/customers/${options.receiverId}/blockchain-wallets`, body)
    clack.log.success(`Created blockchain wallet ${wallet.id} (${wallet.network})`)
    if (options.json)
      console.log(formatOutput(wallet, true))
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function deleteBlockchainWallet(id: string, options: { receiverId: string, json?: boolean }) {
  try {
    const ctx = resolveContext()
    await apiDelete(ctx, `${instancePath(ctx)}/customers/${options.receiverId}/blockchain-wallets/${id}`)
    clack.log.success(`Deleted blockchain wallet ${id}`)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Payouts
export async function listPayouts(options: { json: boolean, status?: string }) {
  try {
    const ctx = resolveContext()
    const endpoint = options.status ? `${instancePath(ctx)}/payouts?status=${encodeURIComponent(options.status)}` : `${instancePath(ctx)}/payouts`
    const res = await apiGet<unknown>(ctx, endpoint)
    const list = extractList(res)
    const display = list.map((p: any) => ({
      id: p.id,
      status: p.status,
      amount: p.sender_amount !== null && p.sender_amount !== undefined ? `${(p.sender_amount / 100)} ${p.token || 'USDC'}` : '-',
      network: p.network || '-',
      created_at: p.created_at,
    }))
    printResult(options.json ? list : display, options.json, ['id', 'status', 'amount', 'network', 'created_at'])
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function getPayout(id: string, options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const payout = await apiGet(ctx, `${instancePath(ctx)}/payouts/${id}`)
    printResult(payout, options.json)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function createPayout(options: { quoteId: string, network?: string, senderWalletAddress: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const network = (options.network ?? 'evm').toLowerCase()
    if (!['evm', 'solana', 'stellar'].includes(network)) {
      exitWithError(`Invalid network: ${options.network}. Use evm, solana, or stellar.`, 1, options.json)
    }
    const body = {
      quote_id: options.quoteId,
      sender_wallet_address: options.senderWalletAddress,
    }
    const payout = await apiPost<{ id: string, status: string }>(ctx, `${instancePath(ctx)}/payouts/${network}`, body)
    clack.log.success(`Created payout ${payout.id} (${payout.status})`)
    if (options.json)
      console.log(formatOutput(payout, true))
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Payins
export async function listPayins(options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/payins`)
    const list = extractList(res)
    const display = list.map((p: any) => ({
      id: p.id,
      status: p.status,
      amount: p.sender_amount !== null && p.sender_amount !== undefined ? `${(p.sender_amount / 100)} ${p.currency || 'USD'}` : '-',
      method: p.payment_method || '-',
      created_at: p.created_at,
    }))
    printResult(options.json ? list : display, options.json, ['id', 'status', 'amount', 'method', 'created_at'])
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function getPayin(id: string, options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const payin = await apiGet(ctx, `${instancePath(ctx)}/payins/${id}`)
    printResult(payin, options.json)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function createPayin(options: { payinQuoteId: string, network?: string, externalId?: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const network = (options.network ?? 'evm').toLowerCase()
    if (!['evm', 'solana', 'stellar'].includes(network)) {
      exitWithError(`Invalid network: ${options.network}. Use evm, solana, or stellar.`, 1, options.json)
    }
    const body = {
      payin_quote_id: options.payinQuoteId,
      external_id: options.externalId ?? null,
    }
    const payin = await apiPost<{ id: string, status: string }>(ctx, `${instancePath(ctx)}/payins/${network}`, body)
    clack.log.success(`Created payin ${payin.id} (${payin.status})`)
    if (options.json)
      console.log(formatOutput(payin, true))
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Payin Quotes
export async function createPayinQuote(options: { blockchainWalletId: string, paymentMethod: string, amount?: string, currency?: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const body = {
      blockchain_wallet_id: options.blockchainWalletId,
      payment_method: options.paymentMethod,
      request_amount: parseAmount(options.amount, 1000, options.json),
      currency: options.currency ?? 'USD',
    }
    const quote = await apiPost<{ id: string, sender_amount: number, receiver_amount: number, payment_method: string, currency: string }>(ctx, `${instancePath(ctx)}/payin-quotes`, body)
    clack.log.success(`Created payin quote ${quote.id} (${(quote.sender_amount || 0) / 100} ${quote.currency} via ${quote.payment_method})`)
    if (!options.json)
      clack.log.message(`Next: blindpay payins create --payin-quote-id ${quote.id}`)
    if (options.json)
      console.log(formatOutput(quote, true))
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Quotes
export async function createQuote(options: {
  bankAccountId: string
  network?: string
  token?: string
  amount?: string
  json: boolean
}) {
  try {
    const ctx = resolveContext()
    const body = {
      bank_account_id: options.bankAccountId,
      network: options.network || 'base',
      token: options.token || 'USDC',
      request_amount: parseAmount(options.amount, 1000, options.json),
    }
    const quote = await apiPost<{ id: string, sender_amount: number, receiver_amount: number, token?: string, currency?: string }>(ctx, `${instancePath(ctx)}/quotes`, body)
    const token = quote.token ?? 'USDC'
    const currency = (quote as any).currency ?? 'USD'
    clack.log.success(`Created quote ${quote.id} (${(quote.sender_amount || 0) / 100} ${token} -> ${(quote.receiver_amount || 0) / 100} ${currency})`)
    if (!options.json)
      clack.log.message(`Next: blindpay payouts create --quote-id ${quote.id}`)
    if (options.json)
      console.log(formatOutput(quote, true))
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Webhook Endpoints
export async function listWebhookEndpoints(options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/webhook-endpoints`)
    const list = extractList(res)
    const display = list.map((e: any) => ({ id: e.id, url: e.url, description: e.description }))
    printResult(options.json ? list : display, options.json, ['id', 'url', 'description'])
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function createWebhookEndpoint(options: { url: string, description?: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const endpoint = await apiPost<{ id: string, url: string }>(ctx, `${instancePath(ctx)}/webhook-endpoints`, { url: options.url, description: options.description || null })
    clack.log.success(`Created webhook endpoint ${endpoint.id} -> ${endpoint.url}`)
    if (options.json)
      console.log(formatOutput(endpoint, true))
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function deleteWebhookEndpoint(id: string, options: { json?: boolean } = {}) {
  try {
    const ctx = resolveContext()
    await apiDelete(ctx, `${instancePath(ctx)}/webhook-endpoints/${id}`)
    clack.log.success(`Deleted webhook endpoint ${id}`)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Partner Fees
export async function listPartnerFees(options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/partner-fees`)
    const list = extractList(res)
    const display = list.map((f: any) => ({
      id: f.id,
      payout_pct: `${(f.payout_percentage_fee || 0) / 100}%`,
      payout_flat: `$${(f.payout_flat_fee || 0) / 100}`,
      payin_pct: `${(f.payin_percentage_fee || 0) / 100}%`,
      payin_flat: `$${(f.payin_flat_fee || 0) / 100}`,
    }))
    printResult(options.json ? list : display, options.json, ['id', 'payout_pct', 'payout_flat', 'payin_pct', 'payin_flat'])
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function createPartnerFee(options: {
  name?: string
  payinPercentage?: string
  payinFlat?: string
  payoutPercentage?: string
  payoutFlat?: string
  evmWallet?: string
  stellarWallet?: string
  json: boolean
}) {
  try {
    const ctx = resolveContext()
    const parseFee = (val: string | undefined, label: string): number => {
      if (val === undefined) return 0
      const n = Number(val)
      if (!Number.isFinite(n) || n < 0) exitWithError(`Invalid ${label}: "${val}". Must be a non-negative number.`, 1, options.json)
      return n * 100
    }
    const body: Record<string, any> = {
      name: options.name || 'CLI Partner Fee',
      payin_percentage_fee: parseFee(options.payinPercentage, 'payin percentage'),
      payin_flat_fee: parseFee(options.payinFlat, 'payin flat fee'),
      payout_percentage_fee: parseFee(options.payoutPercentage, 'payout percentage'),
      payout_flat_fee: parseFee(options.payoutFlat, 'payout flat fee'),
      evm_wallet_address: options.evmWallet ?? null,
      stellar_wallet_address: options.stellarWallet ?? null,
    }
    const fee = await apiPost<{ id: string }>(ctx, `${instancePath(ctx)}/partner-fees`, body)
    clack.log.success(`Created partner fee ${fee.id}`)
    if (options.json)
      console.log(formatOutput(fee, true))
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function deletePartnerFee(id: string, options: { json?: boolean } = {}) {
  try {
    const ctx = resolveContext()
    await apiDelete(ctx, `${instancePath(ctx)}/partner-fees/${id}`)
    clack.log.success(`Deleted partner fee ${id}`)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// API Keys
export async function listApiKeys(options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/api-keys`)
    const list = extractList(res)
    const maskKey = (s: string | null) => (!s ? '-' : s.length > 8 ? `${s.slice(0, 4)}...${s.slice(-4)}` : '***')
    const display = list.map((k: any) => ({ id: k.id, name: k.name, key: maskKey(k.key), permission: k.permission }))
    printResult(options.json ? list : display, options.json, ['id', 'name', 'key', 'permission'])
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function createApiKey(options: { name?: string, permission?: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const body: Record<string, string> = { name: options.name || 'CLI API Key' }
    if (options.permission) body.permission = options.permission
    const key = await apiPost<{ id: string, key: string }>(ctx, `${instancePath(ctx)}/api-keys`, body)
    clack.log.success(`Created API key ${key.id}`)
    clack.log.warning(`Secret: ${key.key}`)
    clack.log.message('Save this key now — it will not be shown again.')
    if (options.json)
      console.log(formatOutput(key, true))
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function deleteApiKey(id: string, options: { json?: boolean } = {}) {
  try {
    const ctx = resolveContext()
    await apiDelete(ctx, `${instancePath(ctx)}/api-keys/${id}`)
    clack.log.success(`Deleted API key ${id}`)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Virtual Accounts
export async function listVirtualAccounts(options: { receiverId: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/customers/${options.receiverId}/virtual-accounts`)
    const list = extractList(res)
    const display = list.map((a: any) => ({ id: a.id, account_number: a.account_number, routing_number: a.routing_number, kyc_status: a.kyc_status }))
    printResult(options.json ? list : display, options.json, ['id', 'account_number', 'routing_number', 'kyc_status'])
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function createVirtualAccount(options: { receiverId: string, blockchainWalletId: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const account = await apiPost<{ id: string }>(ctx, `${instancePath(ctx)}/customers/${options.receiverId}/virtual-accounts`, { blockchain_wallet_id: options.blockchainWalletId })
    clack.log.success(`Created virtual account ${account.id}`)
    if (options.json)
      console.log(formatOutput(account, true))
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Offramp Wallets
export async function listOfframpWallets(options: { receiverId: string, bankAccountId: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/customers/${options.receiverId}/bank-accounts/${options.bankAccountId}/offramp-wallets`)
    const list = extractList(res)
    const display = list.map((w: any) => ({ id: w.id, address: truncate(w.address, 20), network: w.network }))
    printResult(options.json ? list : display, options.json, ['id', 'address', 'network'])
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Instances
export async function getInstance(options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const instance = await apiGet(ctx, `${instancePath(ctx)}`)
    printResult(instance, options.json)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function listInstanceMembers(options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/members`)
    const list = extractList(res)
    const display = list.map((m: any) => ({ id: m.id, email: m.email, role: m.role, name: m.name || '-' }))
    printResult(options.json ? list : display, options.json, ['id', 'email', 'role', 'name'])
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function updateInstance(options: {
  name?: string
  webhookUrl?: string
  json: boolean
}) {
  try {
    const ctx = resolveContext()
    const body: Record<string, any> = {}
    if (options.name !== undefined) body.name = options.name
    if (options.webhookUrl !== undefined) body.webhook_url = options.webhookUrl
    if (Object.keys(body).length === 0) {
      exitWithError('Provide at least one field to update (e.g. --name, --webhook-url)', 1, options.json)
    }
    const instance = await apiPut<Record<string, any>>(ctx, `${instancePath(ctx)}`, body)
    clack.log.success('Instance updated')
    printResult(instance, options.json)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Receiver Limits
export async function getReceiverLimits(receiverId: string, options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const limits = await apiGet(ctx, `${instancePath(ctx)}/customers/${receiverId}/limits`)
    printResult(limits, options.json)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function getReceiverLimitsIncreaseRequests(receiverId: string, options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/customers/${receiverId}/limits-increase-requests`)
    const list = extractList(res)
    printResult(list, options.json)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// FX Rates
export async function getQuoteFxRate(options: { from?: string, to?: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const params = new URLSearchParams()
    if (options.from) params.set('from', options.from)
    if (options.to) params.set('to', options.to)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const rate = await apiGet(ctx, `${instancePath(ctx)}/fx-rates${qs}`)
    printResult(rate, options.json)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

// Available
export async function listAvailableRails(options: { json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/available/rails`)
    const list = extractList(res)
    printResult(list, options.json, ['type', 'currency', 'country', 'name'])
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}

export async function getAvailableBankDetails(options: { rail: string, json: boolean }) {
  try {
    const ctx = resolveContext()
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/available/bank-details/${options.rail}`)
    printResult(res, options.json)
  }
  catch (e) {
    handleApiError(e, options.json)
  }
}
