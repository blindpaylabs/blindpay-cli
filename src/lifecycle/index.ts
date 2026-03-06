import { store } from '../store/index'
import type { Payout, Payin, PayoutStatus } from '../types'
import { dispatchWebhook } from '../webhooks/dispatcher'
import { logger } from '../utils/logger'

let manualMode = false
let advanceDelay = 2000

export function setLifecycleOptions(options: { manual: boolean, delay: number }) {
  manualMode = options.manual
  advanceDelay = options.delay
}

function getPayoutWithQuoteData(payout: Payout) {
  const quote = store.quotes.get(payout.quote_id)
  const bankAccount = quote ? store.bankAccounts.get(quote.bank_account_id) : null
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
    receiver_id: bankAccount ? (store.bankAccounts.get(quote!.bank_account_id)?.receiver_id ?? null) : null,
    bank_account_id: quote?.bank_account_id ?? null,
    offramp_wallet_id: null,
  }
}

function getPayinWithQuoteData(payin: Payin) {
  const quote = store.payinQuotes.get(payin.payin_quote_id)
  return {
    id: payin.id,
    status: payin.status,
    pix_code: payin.pix_code,
    clabe: payin.clabe,
    tracking_transaction: payin.tracking_transaction,
    tracking_payment: payin.tracking_payment,
    tracking_complete: payin.tracking_complete,
    tracking_partner_fee: payin.tracking_partner_fee,
    blockchain_wallet_id: quote?.blockchain_wallet_id ?? null,
    network: quote?.network ?? null,
    token: quote?.token ?? null,
    sender_amount: quote?.sender_amount ?? null,
    receiver_amount: quote?.receiver_amount ?? null,
    currency: quote?.currency ?? null,
    payment_method: quote?.payment_method ?? null,
  }
}

export async function schedulePayoutAdvancement(payoutId: string) {
  if (manualMode)
    return

  const payout = store.payouts.get(payoutId)
  if (!payout)
    return

  const quote = store.quotes.get(payout.quote_id)
  const isSwift = quote ? store.bankAccounts.get(quote.bank_account_id)?.type === 'international_swift' : false

  // Step 1: tracking_transaction completes
  setTimeout(async () => {
    const p = store.payouts.get(payoutId)
    if (!p || p.status === 'completed' || p.status === 'failed')
      return

    p.tracking_transaction = {
      step: 'completed',
      transaction_hash: `0xmock${Date.now().toString(16)}`,
      completed_at: new Date().toISOString(),
    }
    store.payouts.set(payoutId, p)
    logger.lifecycle('payout', payoutId, 'tracking_transaction: processing', 'tracking_transaction: completed')
    await dispatchWebhook('payout.update', getPayoutWithQuoteData(p))

    // Step 2: tracking_payment completes (or goes to on_hold for SWIFT)
    setTimeout(async () => {
      const p2 = store.payouts.get(payoutId)
      if (!p2 || p2.status === 'completed' || p2.status === 'failed')
        return

      if (isSwift) {
        p2.status = 'on_hold'
        p2.tracking_documents = { step: 'processing', status: 'waiting_documents' }
        p2.tracking_payment = { step: 'on_hold', estimated_time_of_arrival: '5_business_days' }
        store.payouts.set(payoutId, p2)
        logger.lifecycle('payout', payoutId, 'processing', 'on_hold (SWIFT - awaiting documents)')
        await dispatchWebhook('payout.update', getPayoutWithQuoteData(p2))

        // Auto-advance SWIFT after another delay
        setTimeout(async () => {
          const p3 = store.payouts.get(payoutId)
          if (!p3 || p3.status === 'completed' || p3.status === 'failed')
            return
          completePayout(p3, payoutId)
        }, advanceDelay)
      }
      else {
        p2.tracking_payment = {
          step: 'completed',
          provider_name: 'JPMorgan Chase',
          estimated_time_of_arrival: '5_min',
          completed_at: new Date().toISOString(),
        }
        store.payouts.set(payoutId, p2)
        logger.lifecycle('payout', payoutId, 'tracking_payment: processing', 'tracking_payment: completed')

        // Step 3: complete
        setTimeout(async () => {
          const p3 = store.payouts.get(payoutId)
          if (!p3 || p3.status === 'completed' || p3.status === 'failed')
            return
          completePayout(p3, payoutId)
        }, advanceDelay)
      }
    }, advanceDelay)
  }, advanceDelay)
}

async function completePayout(payout: Payout, payoutId: string) {
  payout.status = 'completed'
  payout.tracking_complete = {
    step: 'completed',
    status: 'paid',
    completed_at: new Date().toISOString(),
  }
  payout.tracking_payment = {
    ...payout.tracking_payment,
    step: 'completed',
    completed_at: payout.tracking_payment.completed_at || new Date().toISOString(),
  }
  if (payout.tracking_documents) {
    payout.tracking_documents = { ...payout.tracking_documents, step: 'completed', completed_at: new Date().toISOString() }
  }
  store.payouts.set(payoutId, payout)
  logger.lifecycle('payout', payoutId, 'processing', 'completed')
  await dispatchWebhook('payout.complete', getPayoutWithQuoteData(payout))
}

export async function schedulePayinAdvancement(payinId: string) {
  if (manualMode)
    return

  const payin = store.payins.get(payinId)
  if (!payin)
    return

  // Step 1: tracking_payment completes (fiat received)
  setTimeout(async () => {
    const p = store.payins.get(payinId)
    if (!p || p.status === 'completed' || p.status === 'failed')
      return

    p.tracking_payment = { step: 'completed', completed_at: new Date().toISOString() }
    store.payins.set(payinId, p)
    logger.lifecycle('payin', payinId, 'tracking_payment: processing', 'tracking_payment: completed')
    await dispatchWebhook('payin.update', getPayinWithQuoteData(p))

    // Step 2: tracking_transaction completes (crypto sent)
    setTimeout(async () => {
      const p2 = store.payins.get(payinId)
      if (!p2 || p2.status === 'completed' || p2.status === 'failed')
        return

      p2.tracking_transaction = {
        step: 'completed',
        transaction_hash: `0xmock${Date.now().toString(16)}`,
        completed_at: new Date().toISOString(),
      }
      store.payins.set(payinId, p2)
      logger.lifecycle('payin', payinId, 'tracking_transaction: processing', 'tracking_transaction: completed')

      // Step 3: complete
      setTimeout(async () => {
        const p3 = store.payins.get(payinId)
        if (!p3 || p3.status === 'completed' || p3.status === 'failed')
          return

        p3.status = 'completed'
        p3.tracking_complete = { step: 'completed', status: 'paid', completed_at: new Date().toISOString() }
        store.payins.set(payinId, p3)
        logger.lifecycle('payin', payinId, 'processing', 'completed')
        await dispatchWebhook('payin.complete', getPayinWithQuoteData(p3))
      }, advanceDelay)
    }, advanceDelay)
  }, advanceDelay)
}

export async function advancePayout(payoutId: string, targetStatus?: PayoutStatus) {
  const payout = store.payouts.get(payoutId)
  if (!payout)
    throw new Error(`Payout ${payoutId} not found`)

  if (targetStatus === 'failed') {
    payout.status = 'failed'
    payout.tracking_complete = { step: 'failed', status: 'tokens_refunded', completed_at: new Date().toISOString() }
    store.payouts.set(payoutId, payout)
    logger.lifecycle('payout', payoutId, payout.status, 'failed')
    await dispatchWebhook('payout.update', getPayoutWithQuoteData(payout))
    return payout
  }

  if (targetStatus === 'processing') {
    payout.status = 'processing'
    payout.tracking_transaction = { step: 'processing' }
    payout.tracking_payment = { step: 'processing' }
    payout.tracking_complete = { step: 'processing' }
    payout.tracking_documents = null
    store.payouts.set(payoutId, payout)
    logger.lifecycle('payout', payoutId, 'reset to', 'processing')
    await dispatchWebhook('payout.update', getPayoutWithQuoteData(payout))
    return payout
  }

  if (targetStatus === 'completed' || payout.status === 'processing' || payout.status === 'on_hold') {
    await completePayout(payout, payoutId)
    return payout
  }

  // Default: advance through stages
  if (payout.tracking_transaction.step === 'processing') {
    payout.tracking_transaction = {
      step: 'completed',
      transaction_hash: `0xmock${Date.now().toString(16)}`,
      completed_at: new Date().toISOString(),
    }
    store.payouts.set(payoutId, payout)
    await dispatchWebhook('payout.update', getPayoutWithQuoteData(payout))
  }
  else if (payout.tracking_payment.step !== 'completed') {
    payout.tracking_payment = { step: 'completed', completed_at: new Date().toISOString() }
    store.payouts.set(payoutId, payout)
    await dispatchWebhook('payout.update', getPayoutWithQuoteData(payout))
  }
  else {
    await completePayout(payout, payoutId)
  }

  return payout
}

export async function advancePayin(payinId: string, targetStatus?: string) {
  const payin = store.payins.get(payinId)
  if (!payin)
    throw new Error(`Payin ${payinId} not found`)

  if (targetStatus === 'failed') {
    payin.status = 'failed'
    payin.tracking_complete = { step: 'failed', completed_at: new Date().toISOString() }
    store.payins.set(payinId, payin)
    logger.lifecycle('payin', payinId, payin.status, 'failed')
    await dispatchWebhook('payin.update', getPayinWithQuoteData(payin))
    return payin
  }

  if (targetStatus === 'processing') {
    payin.status = 'processing'
    payin.tracking_payment = { step: 'processing' }
    payin.tracking_transaction = { step: 'processing' }
    payin.tracking_complete = { step: 'processing' }
    store.payins.set(payinId, payin)
    logger.lifecycle('payin', payinId, 'reset to', 'processing')
    await dispatchWebhook('payin.update', getPayinWithQuoteData(payin))
    return payin
  }

  if (targetStatus === 'completed') {
    payin.status = 'completed'
    payin.tracking_payment = { step: 'completed', completed_at: new Date().toISOString() }
    payin.tracking_transaction = { step: 'completed', transaction_hash: `0xmock${Date.now().toString(16)}`, completed_at: new Date().toISOString() }
    payin.tracking_complete = { step: 'completed', status: 'paid', completed_at: new Date().toISOString() }
    store.payins.set(payinId, payin)
    logger.lifecycle('payin', payinId, 'processing', 'completed')
    await dispatchWebhook('payin.complete', getPayinWithQuoteData(payin))
    return payin
  }

  // Default: advance through stages
  if (payin.tracking_payment.step === 'processing') {
    payin.tracking_payment = { step: 'completed', completed_at: new Date().toISOString() }
    store.payins.set(payinId, payin)
    await dispatchWebhook('payin.update', getPayinWithQuoteData(payin))
  }
  else if (payin.tracking_transaction.step === 'processing') {
    payin.tracking_transaction = { step: 'completed', transaction_hash: `0xmock${Date.now().toString(16)}`, completed_at: new Date().toISOString() }
    store.payins.set(payinId, payin)
    await dispatchWebhook('payin.update', getPayinWithQuoteData(payin))
  }
  else {
    payin.status = 'completed'
    payin.tracking_complete = { step: 'completed', status: 'paid', completed_at: new Date().toISOString() }
    store.payins.set(payinId, payin)
    await dispatchWebhook('payin.complete', getPayinWithQuoteData(payin))
  }

  return payin
}
