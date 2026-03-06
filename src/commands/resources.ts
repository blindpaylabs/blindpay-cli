import process from 'node:process'
import * as clack from '@clack/prompts'
import pc from 'picocolors'
import { formatOutput, truncate } from '../utils/output'
import type { ApiContext, ApiError, ValidationErrorItem } from '../utils/api-client'
import { apiGet, apiPost, apiPut, apiDelete, resolveContext, NOT_RUNNING_MSG } from '../utils/api-client'

type PortOption = { port?: number, mock?: boolean }

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

function handleApiError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg === NOT_RUNNING_MSG || (err as any)?.code === 'ECONNREFUSED') {
    clack.log.error(NOT_RUNNING_MSG)
  }
  else {
    clack.log.error(msg)
    const apiErr = err as ApiError
    if (apiErr.validationErrors && apiErr.validationErrors.length > 0) {
      for (const ve of apiErr.validationErrors)
        console.log(pc.dim(`  • ${formatValidationError(ve)}`))
    }
  }
  clack.cancel('Exiting.')
  process.exit(1)
}

/** Normalize list response: real API returns bare array, mock returns { data: [...] }. */
function extractList(res: any): any[] {
  if (Array.isArray(res))
    return res
  if (res?.data && Array.isArray(res.data))
    return res.data
  return []
}

// Receivers
export async function listReceivers(options: { json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/receivers`)
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
    handleApiError(e)
  }
}

export async function getReceiver(id: string, options: { json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
    const receiver = await apiGet(ctx, `${instancePath(ctx)}/receivers/${id}`)
    printResult(receiver, options.json)
  }
  catch (e: any) {
    if (e?.message?.includes('404') || e?.message?.includes('not found')) {
      clack.log.error(`Receiver ${id} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

export async function createReceiver(options: any & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
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
  try {
    const receiver = await apiPost<{ id: string, type: string }>(ctx, `${instancePath(ctx)}/receivers`, body)
    const displayName = body.type === 'business'
      ? (body.legal_name || '—')
      : [body.first_name, body.last_name].filter(Boolean).join(' ').trim() || '—'
    clack.log.success(`Created receiver ${receiver.id} (${receiver.type}, ${displayName})`)
    if (options.json)
      console.log(formatOutput(receiver, true))
  }
  catch (e) {
    handleApiError(e)
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
  } & PortOption,
) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
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
    clack.log.error('Provide at least one field to update (e.g. --name, --kyc-status)')
    process.exit(1)
  }
  try {
    const receiver = await apiPut<Record<string, any>>(ctx, `${instancePath(ctx)}/receivers/${id}`, body)
    clack.log.success(`Updated receiver ${id}`)
    if (options.json)
      console.log(formatOutput(receiver, true))
    else
      console.log(formatOutput(receiver, false))
  }
  catch (e: any) {
    if (e?.message?.includes('404') || e?.message?.includes('not found')) {
      clack.log.error(`Receiver ${id} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

export async function deleteReceiver(id: string, options?: PortOption) {
  const ctx = resolveContext({ port: options?.port, mock: options?.mock })
  try {
    await apiDelete(ctx, `${instancePath(ctx)}/receivers/${id}`)
    clack.log.success(`Deleted receiver ${id}`)
  }
  catch (e: any) {
    if (e?.message?.includes('404') || e?.message?.includes('not found')) {
      clack.log.error(`Receiver ${id} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

// Bank Accounts
export async function listBankAccounts(options: { receiverId: string, json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  const receiverId = options.receiverId
  if (!receiverId)
    throw new Error('--receiver-id is required')
  try {
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/receivers/${receiverId}/bank-accounts`)
    const list = extractList(res)
    const display = list.map((a: any) => ({ id: a.id, type: a.type, name: a.name, status: a.status, country: a.country }))
    printResult(options.json ? list : display, options.json, ['id', 'type', 'name', 'status', 'country'])
  }
  catch (e) {
    handleApiError(e)
  }
}

export async function getBankAccount(id: string, options: { json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
    const account = await apiGet(ctx, `${instancePath(ctx)}/receivers/re_mock_indiv01/bank-accounts/${id}`)
    printResult(account, options.json)
  }
  catch (e: any) {
    if (e?.message?.includes('404') || e?.message?.includes('not found')) {
      clack.log.error(`Bank account ${id} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

export async function createBankAccount(options: any & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  const receiverId = options.receiverId
  if (!receiverId)
    throw new Error('--receiver-id is required')
  const body = {
    type: options.type || 'ach',
    name: options.name || 'CLI Bank Account',
    recipient_relationship: options.recipientRelationship || null,
    pix_key: options.pixKey || null,
    beneficiary_name: options.beneficiaryName || null,
    routing_number: options.routingNumber || null,
    account_number: options.accountNumber || null,
    account_type: options.accountType || null,
    account_class: options.accountClass || null,
    country: options.country || null,
  }
  try {
    const ba = await apiPost<{ id: string, type: string }>(ctx, `${instancePath(ctx)}/receivers/${receiverId}/bank-accounts`, body)
    clack.log.success(`Created bank account ${ba.id} (${ba.type})`)
    if (options.json)
      console.log(formatOutput(ba, true))
  }
  catch (e) {
    handleApiError(e)
  }
}

export async function deleteBankAccount(id: string, options?: PortOption) {
  const ctx = resolveContext({ port: options?.port, mock: options?.mock })
  try {
    await apiDelete(ctx, `${instancePath(ctx)}/receivers/re_mock_indiv01/bank-accounts/${id}`)
    clack.log.success(`Deleted bank account ${id}`)
  }
  catch (e: any) {
    if (e?.message?.includes('404') || e?.message?.includes('not found')) {
      clack.log.error(`Bank account ${id} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

// Blockchain Wallets
export async function listBlockchainWallets(options: { receiverId: string, json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  const receiverId = options.receiverId
  if (!receiverId)
    throw new Error('--receiver-id is required')
  try {
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/receivers/${receiverId}/blockchain-wallets`)
    const list = extractList(res)
    const display = list.map((w: any) => ({ id: w.id, address: truncate(w.address, 20), network: w.network }))
    printResult(options.json ? list : display, options.json, ['id', 'address', 'network'])
  }
  catch (e) {
    handleApiError(e)
  }
}

export async function getBlockchainWallet(id: string, options: { json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
    const wallet = await apiGet(ctx, `${instancePath(ctx)}/receivers/re_mock_indiv01/blockchain-wallets/${id}`)
    printResult(wallet, options.json)
  }
  catch (e: any) {
    if (e?.message?.includes('404') || e?.message?.includes('not found')) {
      clack.log.error(`Blockchain wallet ${id} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

export async function createBlockchainWallet(options: any & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  const receiverId = options.receiverId
  if (!receiverId)
    throw new Error('--receiver-id is required')
  const body = {
    address: options.address,
    network: options.network || 'base',
    external_id: options.externalId || null,
  }
  try {
    const wallet = await apiPost<{ id: string, network: string }>(ctx, `${instancePath(ctx)}/receivers/${receiverId}/blockchain-wallets`, body)
    clack.log.success(`Created blockchain wallet ${wallet.id} (${wallet.network})`)
    if (options.json)
      console.log(formatOutput(wallet, true))
  }
  catch (e) {
    handleApiError(e)
  }
}

export async function deleteBlockchainWallet(id: string, options?: PortOption) {
  const ctx = resolveContext({ port: options?.port, mock: options?.mock })
  try {
    await apiDelete(ctx, `${instancePath(ctx)}/receivers/re_mock_indiv01/blockchain-wallets/${id}`)
    clack.log.success(`Deleted blockchain wallet ${id}`)
  }
  catch (e: any) {
    if (e?.message?.includes('404') || e?.message?.includes('not found')) {
      clack.log.error(`Blockchain wallet ${id} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

// Payouts
export async function listPayouts(options: { json: boolean, status?: string } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
    const path = options.status ? `${instancePath(ctx)}/payouts?status=${encodeURIComponent(options.status)}` : `${instancePath(ctx)}/payouts`
    const res = await apiGet<unknown>(ctx, path)
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
    handleApiError(e)
  }
}

export async function getPayout(id: string, options: { json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
    const payout = await apiGet(ctx, `${instancePath(ctx)}/payouts/${id}`)
    printResult(payout, options.json)
  }
  catch (e: any) {
    if (e?.message?.includes('404') || e?.message?.includes('not found')) {
      clack.log.error(`Payout ${id} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

export async function createPayout(options: { quoteId: string, network?: string, senderWalletAddress?: string, json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  const network = (options.network ?? 'evm').toLowerCase()
  if (!['evm', 'solana', 'stellar'].includes(network)) {
    clack.log.error(`Invalid network: ${options.network}. Use evm, solana, or stellar.`)
    process.exit(1)
  }
  const body = {
    quote_id: options.quoteId,
    sender_wallet_address: options.senderWalletAddress ?? '0x0000000000000000000000000000000000000000',
  }
  try {
    const payout = await apiPost<{ id: string, status: string }>(ctx, `${instancePath(ctx)}/payouts/${network}`, body)
    clack.log.success(`Created payout ${payout.id} (${payout.status})`)
    if (options.json)
      console.log(formatOutput(payout, true))
  }
  catch (e: any) {
    if (e?.message?.includes('Quote') && e?.message?.includes('not found')) {
      clack.log.error(`Quote ${options.quoteId} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

// Payins
export async function listPayins(options: { json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
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
    handleApiError(e)
  }
}

export async function getPayin(id: string, options: { json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
    const payin = await apiGet(ctx, `${instancePath(ctx)}/payins/${id}`)
    printResult(payin, options.json)
  }
  catch (e: any) {
    if (e?.message?.includes('404') || e?.message?.includes('not found')) {
      clack.log.error(`Payin ${id} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

export async function createPayin(options: { payinQuoteId: string, network?: string, externalId?: string, json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  const network = (options.network ?? 'evm').toLowerCase()
  if (!['evm', 'solana', 'stellar'].includes(network)) {
    clack.log.error(`Invalid network: ${options.network}. Use evm, solana, or stellar.`)
    process.exit(1)
  }
  const body = {
    payin_quote_id: options.payinQuoteId,
    external_id: options.externalId ?? null,
  }
  try {
    const payin = await apiPost<{ id: string, status: string }>(ctx, `${instancePath(ctx)}/payins/${network}`, body)
    clack.log.success(`Created payin ${payin.id} (${payin.status})`)
    if (options.json)
      console.log(formatOutput(payin, true))
  }
  catch (e: any) {
    if (e?.message?.includes('Payin quote') && e?.message?.includes('not found')) {
      clack.log.error(`Payin quote ${options.payinQuoteId} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

// Payin quotes (create only – used before createPayin)
export async function createPayinQuote(options: { blockchainWalletId: string, paymentMethod: string, amount?: string, currency?: string, json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  const body = {
    blockchain_wallet_id: options.blockchainWalletId,
    payment_method: options.paymentMethod,
    request_amount: Number.parseInt(options.amount ?? '1000') || 1000,
    currency: options.currency ?? 'USD',
  }
  try {
    const quote = await apiPost<{ id: string, sender_amount: number, receiver_amount: number, payment_method: string, currency: string }>(ctx, `${instancePath(ctx)}/payin-quotes`, body)
    clack.log.success(`Created payin quote ${quote.id} (${(quote.sender_amount || 0) / 100} ${quote.currency} via ${quote.payment_method})`)
    if (!options.json)
      clack.log.message(`Next: blindpay payins create --payin-quote-id ${quote.id}`)
    if (options.json)
      console.log(formatOutput(quote, true))
  }
  catch (e: any) {
    if (e?.message?.includes('Blockchain wallet') && e?.message?.includes('not found')) {
      clack.log.error(`Blockchain wallet ${options.blockchainWalletId} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

// Quotes
export async function createQuote(options: any & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  const bankAccountId = options.bankAccountId
  if (!bankAccountId)
    throw new Error('--bank-account-id is required')
  const body = {
    bank_account_id: bankAccountId,
    network: options.network || 'base',
    token: options.token || 'USDC',
    request_amount: Number.parseInt(options.amount) || 1000,
  }
  try {
    const quote = await apiPost<{ id: string, sender_amount: number, receiver_amount: number, token?: string, currency?: string }>(ctx, `${instancePath(ctx)}/quotes`, body)
    const token = quote.token ?? 'USDC'
    const currency = (quote as any).currency ?? 'USD'
    clack.log.success(`Created quote ${quote.id} (${(quote.sender_amount || 0) / 100} ${token} -> ${(quote.receiver_amount || 0) / 100} ${currency})`)
    if (!options.json)
      clack.log.message(`Next: blindpay payouts create --quote-id ${quote.id}`)
    if (options.json)
      console.log(formatOutput(quote, true))
  }
  catch (e: any) {
    if (e?.message?.includes('Bank account') && e?.message?.includes('not found')) {
      clack.log.error(`Bank account ${bankAccountId} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

// Webhook Endpoints
export async function listWebhookEndpoints(options: { json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/webhook-endpoints`)
    const list = extractList(res)
    const display = list.map((e: any) => ({ id: e.id, url: e.url, description: e.description }))
    printResult(options.json ? list : display, options.json, ['id', 'url', 'description'])
  }
  catch (e) {
    handleApiError(e)
  }
}

export async function createWebhookEndpoint(options: { url: string, description?: string, json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
    const endpoint = await apiPost<{ id: string, url: string }>(ctx, `${instancePath(ctx)}/webhook-endpoints`, { url: options.url, description: options.description || null })
    clack.log.success(`Created webhook endpoint ${endpoint.id} -> ${endpoint.url}`)
    if (options.json)
      console.log(formatOutput(endpoint, true))
  }
  catch (e) {
    handleApiError(e)
  }
}

export async function deleteWebhookEndpoint(id: string, options?: PortOption) {
  const ctx = resolveContext({ port: options?.port, mock: options?.mock })
  try {
    await apiDelete(ctx, `${instancePath(ctx)}/webhook-endpoints/${id}`)
    clack.log.success(`Deleted webhook endpoint ${id}`)
  }
  catch (e: any) {
    if (e?.message?.includes('404') || e?.message?.includes('not found')) {
      clack.log.error(`Webhook endpoint ${id} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

// Partner Fees
export async function listPartnerFees(options: { json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
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
    handleApiError(e)
  }
}

export async function createPartnerFee(options: any & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  const body = {
    payin_percentage_fee: Number.parseFloat(options.payinPercentage || '0') * 100,
    payin_flat_fee: Number.parseFloat(options.payinFlat || '0') * 100,
    payout_percentage_fee: Number.parseFloat(options.payoutPercentage || '0') * 100,
    payout_flat_fee: Number.parseFloat(options.payoutFlat || '0') * 100,
    evm_wallet_address: options.evmWallet || null,
    stellar_wallet_address: options.stellarWallet || null,
  }
  try {
    const fee = await apiPost<{ id: string }>(ctx, `${instancePath(ctx)}/partner-fees`, body)
    clack.log.success(`Created partner fee ${fee.id}`)
    if (options.json)
      console.log(formatOutput(fee, true))
  }
  catch (e) {
    handleApiError(e)
  }
}

export async function deletePartnerFee(id: string, options?: PortOption) {
  const ctx = resolveContext({ port: options?.port, mock: options?.mock })
  try {
    await apiDelete(ctx, `${instancePath(ctx)}/partner-fees/${id}`)
    clack.log.success(`Deleted partner fee ${id}`)
  }
  catch (e: any) {
    if (e?.message?.includes('404') || e?.message?.includes('not found')) {
      clack.log.error(`Partner fee ${id} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

// API Keys
export async function listApiKeys(options: { json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/api-keys`)
    const list = extractList(res)
    const display = list.map((k: any) => ({ id: k.id, name: k.name, key: `${(k.key || '').slice(0, 16)}...`, permission: k.permission }))
    printResult(options.json ? list : display, options.json, ['id', 'name', 'key', 'permission'])
  }
  catch (e) {
    handleApiError(e)
  }
}

export async function createApiKey(options: { name?: string, json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  try {
    const key = await apiPost<{ id: string, key: string }>(ctx, `${instancePath(ctx)}/api-keys`, { name: options.name || 'CLI API Key' })
    clack.log.success(`Created API key ${key.id}: ${key.key}`)
    if (options.json)
      console.log(formatOutput(key, true))
  }
  catch (e) {
    handleApiError(e)
  }
}

export async function deleteApiKey(id: string, options?: PortOption) {
  const ctx = resolveContext({ port: options?.port, mock: options?.mock })
  try {
    await apiDelete(ctx, `${instancePath(ctx)}/api-keys/${id}`)
    clack.log.success(`Deleted API key ${id}`)
  }
  catch (e: any) {
    if (e?.message?.includes('404') || e?.message?.includes('not found')) {
      clack.log.error(`API key ${id} not found`)
    }
    else {
      handleApiError(e)
    }
    clack.cancel('Exiting.')
    process.exit(1)
  }
}

// Virtual Accounts
export async function listVirtualAccounts(options: { receiverId: string, json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  const receiverId = options.receiverId
  if (!receiverId)
    throw new Error('--receiver-id is required')
  try {
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/receivers/${receiverId}/virtual-accounts`)
    const list = extractList(res)
    const display = list.map((a: any) => ({ id: a.id, account_number: a.account_number, routing_number: a.routing_number, kyc_status: a.kyc_status }))
    printResult(options.json ? list : display, options.json, ['id', 'account_number', 'routing_number', 'kyc_status'])
  }
  catch (e) {
    handleApiError(e)
  }
}

export async function createVirtualAccount(options: { receiverId: string, blockchainWalletId: string, json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  const receiverId = options.receiverId
  const blockchainWalletId = options.blockchainWalletId
  if (!receiverId)
    throw new Error('--receiver-id is required')
  if (!blockchainWalletId)
    throw new Error('--blockchain-wallet-id is required')
  try {
    const account = await apiPost<{ id: string }>(ctx, `${instancePath(ctx)}/receivers/${receiverId}/virtual-accounts`, { blockchain_wallet_id: blockchainWalletId })
    clack.log.success(`Created virtual account ${account.id}`)
    if (options.json)
      console.log(formatOutput(account, true))
  }
  catch (e) {
    handleApiError(e)
  }
}

// Offramp Wallets
export async function listOfframpWallets(options: { receiverId: string, bankAccountId: string, json: boolean } & PortOption) {
  const ctx = resolveContext({ port: options.port, mock: options.mock })
  const receiverId = options.receiverId
  const bankAccountId = options.bankAccountId
  if (!receiverId)
    throw new Error('--receiver-id is required')
  if (!bankAccountId)
    throw new Error('--bank-account-id is required')
  try {
    const res = await apiGet<unknown>(ctx, `${instancePath(ctx)}/receivers/${receiverId}/bank-accounts/${bankAccountId}/offramp-wallets`)
    const list = extractList(res)
    const display = list.map((w: any) => ({ id: w.id, address: truncate(w.address, 20), network: w.network }))
    printResult(options.json ? list : display, options.json, ['id', 'address', 'network'])
  }
  catch (e) {
    handleApiError(e)
  }
}

// Available (local reference data - no HTTP)
export async function listAvailableRails(options: { json: boolean }) {
  const { availableRails } = await import('../utils/constants')
  printResult(options.json ? availableRails : availableRails, options.json, ['type', 'currency', 'country', 'name'])
}

export async function getAvailableBankDetails(options: { rail: string, json: boolean }) {
  const fields: Record<string, string[]> = {
    ach: ['beneficiary_name', 'routing_number', 'account_number', 'account_type', 'account_class'],
    wire: ['beneficiary_name', 'routing_number', 'account_number', 'address_line_1', 'city', 'state_province_region', 'country', 'postal_code'],
    pix: ['pix_key'],
    pix_safe: ['beneficiary_name', 'account_number', 'account_type', 'pix_safe_bank_code', 'pix_safe_branch_code', 'pix_safe_cpf_cnpj'],
    spei_bitso: ['beneficiary_name', 'spei_protocol', 'spei_clabe'],
    transfers_bitso: ['beneficiary_name', 'transfers_type', 'transfers_account'],
    ach_cop_bitso: ['ach_cop_beneficiary_first_name', 'ach_cop_beneficiary_last_name', 'ach_cop_document_id', 'ach_cop_document_type', 'ach_cop_email', 'ach_cop_bank_code', 'ach_cop_bank_account', 'account_type'],
    international_swift: ['swift_code_bic', 'swift_account_holder_name', 'swift_account_number_iban', 'swift_beneficiary_address_line_1', 'swift_beneficiary_country', 'swift_beneficiary_city', 'swift_beneficiary_state_province_region', 'swift_beneficiary_postal_code', 'swift_bank_name', 'swift_bank_address_line_1', 'swift_bank_country', 'swift_bank_city', 'swift_bank_state_province_region', 'swift_bank_postal_code'],
  }
  const result = fields[options.rail]
  if (!result) {
    const available = Object.keys(fields).join(', ')
    clack.log.error(`Unknown rail "${options.rail}". Available rails: ${available}`)
    return
  }
  if (options.json) {
    console.log(formatOutput({ rail: options.rail, fields: result }, true))
  }
  else {
    clack.note(result.map(f => `  ${f}`).join('\n'), `Required fields for ${options.rail}`)
  }
}

// Status (HTTP to _internal/status) — always mock server
export async function showStatus(options?: { json?: boolean } & PortOption) {
  const ctx = resolveContext({ port: options?.port, mock: true })
  try {
    const data = await apiGet<Record<string, number>>(ctx, '/_internal/status')
    if (options?.json) {
      console.log(formatOutput(data, true))
      return
    }
    console.log()
    clack.log.message(pc.bold('Mock Server Data:'))
    console.log(`  Instances:          ${data.instances ?? 0}`)
    console.log(`  Receivers:          ${data.receivers ?? 0}`)
    console.log(`  Bank Accounts:      ${data.bankAccounts ?? 0}`)
    console.log(`  Blockchain Wallets: ${data.blockchainWallets ?? 0}`)
    console.log(`  Quotes:             ${data.quotes ?? 0}`)
    console.log(`  Payouts:            ${data.payouts ?? 0}`)
    console.log(`  Payin Quotes:       ${data.payinQuotes ?? 0}`)
    console.log(`  Payins:             ${data.payins ?? 0}`)
    console.log(`  API Keys:           ${data.apiKeys ?? 0}`)
    console.log(`  Webhook Endpoints:  ${data.webhookEndpoints ?? 0}`)
    console.log(`  Partner Fees:       ${data.partnerFees ?? 0}`)
    console.log(`  Virtual Accounts:   ${data.virtualAccounts ?? 0}`)
    console.log(`  Offramp Wallets:    ${data.offrampWallets ?? 0}`)
    console.log()
  }
  catch (e) {
    handleApiError(e)
  }
}
