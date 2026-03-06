import { describe, test, expect, beforeEach } from 'bun:test'
import { store } from '../store/index'
import { setLifecycleOptions, advancePayout, advancePayin } from '../lifecycle/index'
import { generateId } from '../utils/id'
import { MOCK_INSTANCE_ID } from '../utils/constants'

beforeEach(() => {
  setLifecycleOptions({ manual: true, delay: 100 })
})

describe('lifecycle', () => {
  test('advancePayout completes payout when status is processing', async () => {
    const quoteId = generateId('quote')
    const payoutId = generateId('payout')
    store.quotes.set(quoteId, {
      id: quoteId,
      request_amount: 1000,
      cover_fees: true,
      currency_type: 'sender',
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      currency: 'USD',
      network: 'base',
      token: 'USDC',
      commercial_quotation: 100,
      blindpay_quotation: 98,
      receiver_amount: 1000,
      sender_amount: 1000,
      description: null,
      partner_fee_amount: 0,
      flat_fee: 0,
      billing_fee: 0,
      billing_fee_amount: 0,
      transaction_fee_amount: 0,
      total_fee_amount: 0,
      bank_account_id: 'ba_mock_ach001',
      instance_id: MOCK_INSTANCE_ID,
      partner_fee_id: null,
      contract: null,
      receiver_local_amount: null,
      transaction_document_type: null,
      transaction_document_id: null,
      transaction_document_file: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    const receiverId = store.bankAccounts.get('ba_mock_ach001')?.receiver_id ?? 're_mock_indiv01'
    store.payouts.set(payoutId, {
      id: payoutId,
      quote_id: quoteId,
      status: 'processing',
      sender_wallet_address: '0xmock',
      signed_transaction: null,
      partner_fee: 0,
      tracking_transaction: { step: 'processing' },
      tracking_payment: { step: 'processing' },
      tracking_complete: { step: 'processing' },
      tracking_partner_fee: null,
      tracking_liquidity: null,
      tracking_documents: null,
      jpm_track_data: null,
      instance_id: MOCK_INSTANCE_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    await advancePayout(payoutId)
    const p = store.payouts.get(payoutId)
    expect(p).toBeDefined()
    expect(p!.status).toBe('completed')
    expect(p!.tracking_complete.step).toBe('completed')
    expect(p!.tracking_payment.step).toBe('completed')
  })

  test('advancePayout to failed', async () => {
    const quoteId = generateId('quote')
    const payoutId = generateId('payout')
    store.quotes.set(quoteId, {
      id: quoteId,
      request_amount: 1000,
      cover_fees: true,
      currency_type: 'sender',
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      currency: 'USD',
      network: 'base',
      token: 'USDC',
      commercial_quotation: 100,
      blindpay_quotation: 98,
      receiver_amount: 1000,
      sender_amount: 1000,
      description: null,
      partner_fee_amount: 0,
      flat_fee: 0,
      billing_fee: 0,
      billing_fee_amount: 0,
      transaction_fee_amount: 0,
      total_fee_amount: 0,
      bank_account_id: 'ba_mock_ach001',
      instance_id: MOCK_INSTANCE_ID,
      partner_fee_id: null,
      contract: null,
      receiver_local_amount: null,
      transaction_document_type: null,
      transaction_document_id: null,
      transaction_document_file: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    store.payouts.set(payoutId, {
      id: payoutId,
      quote_id: quoteId,
      status: 'processing',
      sender_wallet_address: '0xmock',
      signed_transaction: null,
      partner_fee: 0,
      tracking_transaction: { step: 'processing' },
      tracking_payment: { step: 'processing' },
      tracking_complete: { step: 'processing' },
      tracking_partner_fee: null,
      tracking_liquidity: null,
      tracking_documents: null,
      jpm_track_data: null,
      instance_id: MOCK_INSTANCE_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    await advancePayout(payoutId, 'failed')
    const p = store.payouts.get(payoutId)
    expect(p!.status).toBe('failed')
  })

  test('advancePayin to completed', async () => {
    const pqId = generateId('payinQuote')
    const payinId = generateId('payin')
    store.payinQuotes.set(pqId, {
      id: pqId,
      request_amount: 1000,
      currency_type: 'sender',
      blockchain_wallet_id: 'bw_mock_evm001',
      payment_method: 'ach',
      sender_amount: 1000,
      receiver_amount: 1000,
      currency: 'USD',
      network: 'base',
      token: 'USDC',
      commercial_quotation: 100,
      blindpay_quotation: 98,
      partner_fee_amount: 0,
      flat_fee: 0,
      billing_fee: 0,
      total_fee_amount: 0,
      partner_fee_id: null,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      instance_id: MOCK_INSTANCE_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    store.payins.set(payinId, {
      id: payinId,
      payin_quote_id: pqId,
      status: 'processing',
      pix_code: null,
      clabe: null,
      external_id: null,
      partner_fee: 0,
      tracking_payment: { step: 'processing' },
      tracking_transaction: { step: 'processing' },
      tracking_complete: { step: 'processing' },
      tracking_partner_fee: null,
      instance_id: MOCK_INSTANCE_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    await advancePayin(payinId, 'completed')
    const pi = store.payins.get(payinId)
    expect(pi!.status).toBe('completed')
    expect(pi!.tracking_complete.step).toBe('completed')
  })

  test('advancePayout throws when payout not found', async () => {
    await expect(advancePayout('pa_nonexistent')).rejects.toThrow('not found')
  })

  test('advancePayin throws when payin not found', async () => {
    await expect(advancePayin('pi_nonexistent')).rejects.toThrow('not found')
  })
})
