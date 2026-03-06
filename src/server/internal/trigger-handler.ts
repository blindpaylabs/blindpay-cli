import { store } from '../../store/index'
import { dispatchWebhook, getForwardUrls } from '../../webhooks/dispatcher'
import { generateId } from '../../utils/id'
import { MOCK_INSTANCE_ID, webhookEvents } from '../../utils/constants'
import type { WebhookEvent } from '../../types'

function generateMockPayoutWebhookData() {
  return {
    id: generateId('payout'),
    status: 'completed' as const,
    sender_wallet_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    billing_fee_amount: 0,
    transaction_fee_amount: 0,
    partner_fee: 0,
    tracking_complete: { step: 'completed' as const, status: 'paid', completed_at: new Date().toISOString() },
    tracking_payment: { step: 'completed' as const, completed_at: new Date().toISOString() },
    tracking_transaction: { step: 'completed' as const, transaction_hash: `0xmock${Date.now().toString(16)}`, completed_at: new Date().toISOString() },
    tracking_partner_fee: null,
    tracking_liquidity: null,
    tracking_documents: null,
    receiver_id: 're_mock_indiv01',
    bank_account_id: 'ba_mock_ach001',
    offramp_wallet_id: null,
  }
}

function generateMockPayinWebhookData() {
  return {
    id: generateId('payin'),
    status: 'completed' as const,
    pix_code: null,
    clabe: null,
    tracking_transaction: { step: 'completed' as const, transaction_hash: `0xmock${Date.now().toString(16)}`, completed_at: new Date().toISOString() },
    tracking_payment: { step: 'completed' as const, completed_at: new Date().toISOString() },
    tracking_complete: { step: 'completed' as const, status: 'paid', completed_at: new Date().toISOString() },
    tracking_partner_fee: null,
    blockchain_wallet_id: 'bw_mock_evm001',
    network: 'base',
    token: 'USDC',
    sender_amount: 10000,
    receiver_amount: 10000,
    currency: 'USD',
    payment_method: 'ach',
  }
}

function generateMockReceiverWebhookData() {
  const receiver = store.receivers.get('re_mock_indiv01')
  if (receiver)
    return { ...receiver, limit: { per_transaction: 1000000, daily: 5000000, monthly: 25000000 }, is_tos_accepted: true }
  return {
    id: generateId('receiver'),
    type: 'individual',
    kyc_type: 'standard',
    kyc_status: 'approved',
    email: 'triggered@example.com',
    first_name: 'Triggered',
    last_name: 'Receiver',
    country: 'US',
    instance_id: MOCK_INSTANCE_ID,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    limit: { per_transaction: 1000000, daily: 5000000, monthly: 25000000 },
    is_tos_accepted: true,
  }
}

function generateMockBankAccountWebhookData() {
  const ba = store.bankAccounts.get('ba_mock_ach001')
  if (ba) return ba
  return {
    id: generateId('bankAccount'),
    type: 'ach',
    name: 'Triggered Bank Account',
    status: 'approved',
    instance_id: MOCK_INSTANCE_ID,
    created_at: new Date().toISOString(),
  }
}

function generateMockBlockchainWalletWebhookData() {
  const bw = store.blockchainWallets.get('bw_mock_evm001')
  if (bw) return bw
  return {
    id: generateId('blockchainWallet'),
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    network: 'base',
    instance_id: MOCK_INSTANCE_ID,
    created_at: new Date().toISOString(),
  }
}

function generateMockLimitIncreaseData(status: 'in_review' | 'approved' | 'rejected') {
  const now = new Date().toISOString()
  const id = `ri_${generateId('receiver').slice(3)}`
  return {
    id,
    status,
    per_transaction: 500000,
    daily: 2000000,
    monthly: 10000000,
    approved_per_transaction: status === 'approved' ? 500000 : null,
    approved_daily: status === 'approved' ? 2000000 : null,
    approved_monthly: status === 'approved' ? 10000000 : null,
    supporting_document_type: 'individual_bank_statement',
    supporting_document_file: 'https://mock.blindpay.com/uploads/mock-limit-increase.pdf',
    receiver_id: 're_mock_indiv01',
    created_at: now,
    updated_at: now,
  }
}

function generateMockVirtualAccountData(kycStatus: 'verifying' | 'approved') {
  const now = new Date().toISOString()
  return {
    id: generateId('virtualAccount'),
    banking_partner: 'jpmorgan',
    kyc_status: kycStatus,
    us: {
      ach: { routing_number: '021000021', account_number: '9876543210' },
      wire: { routing_number: '021000021', account_number: '9876543210' },
      rtp: null,
      swift_bic_code: 'CHASUS33',
      account_type: 'Business checking',
      beneficiary: {
        name: 'John Doe',
        address_line_1: '8 The Green, #19364',
        address_line_2: 'Dover, DE 19901',
      },
      receiving_bank: {
        name: 'JPMorgan Chase',
        address_line_1: '270 Park Ave',
        address_line_2: 'New York, NY, 10017-2070',
      },
    },
    token: 'USDC',
    blockchain_wallet_id: 'bw_mock_evm001',
    blockchain_wallet: {
      network: 'base',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    },
    created_at: now,
    updated_at: now,
  }
}

const dataGenerators: Record<string, () => Record<string, unknown>> = {
  'payout.new': () => ({ ...generateMockPayoutWebhookData(), status: 'processing' }),
  'payout.update': () => ({ ...generateMockPayoutWebhookData(), status: 'processing' }),
  'payout.complete': generateMockPayoutWebhookData,
  'payout.partnerFee': generateMockPayoutWebhookData,
  'payin.new': () => ({ ...generateMockPayinWebhookData(), status: 'processing' }),
  'payin.update': () => ({ ...generateMockPayinWebhookData(), status: 'processing' }),
  'payin.complete': generateMockPayinWebhookData,
  'payin.partnerFee': generateMockPayinWebhookData,
  'receiver.new': generateMockReceiverWebhookData,
  'receiver.update': generateMockReceiverWebhookData,
  'bankAccount.new': () => ({ ...generateMockBankAccountWebhookData() }),
  'blockchainWallet.new': () => ({ ...generateMockBlockchainWalletWebhookData() }),
  'tos.accept': () => ({ receiver_id: 're_mock_indiv01', instance_id: MOCK_INSTANCE_ID }),
  'limitIncrease.new': () => generateMockLimitIncreaseData('in_review'),
  'limitIncrease.update': () => generateMockLimitIncreaseData('approved'),
  'virtualAccount.new': () => generateMockVirtualAccountData('verifying'),
  'virtualAccount.complete': () => generateMockVirtualAccountData('approved'),
}

export function isTriggerEvent(name: string): name is WebhookEvent {
  return webhookEvents.includes(name as WebhookEvent)
}

export async function handleTrigger(eventName: string, options: { payoutId?: string; payinId?: string }): Promise<{ sent: number }> {
  if (!isTriggerEvent(eventName)) {
    throw new Error(`Unknown event: ${eventName}. Available: ${webhookEvents.join(', ')}`)
  }
  const forwardUrls = getForwardUrls()
  if (forwardUrls.length === 0) {
    throw new Error('No forward URLs configured. Start the mock server with --forward-to.')
  }
  const event = eventName as WebhookEvent
  let data: Record<string, unknown>
  if (options.payoutId && event.startsWith('payout.')) {
    const payout = store.payouts.get(options.payoutId)
    if (payout) {
      data = { ...generateMockPayoutWebhookData(), id: payout.id, status: payout.status }
    } else {
      data = { ...generateMockPayoutWebhookData(), id: options.payoutId }
    }
  } else if (options.payinId && event.startsWith('payin.')) {
    const payin = store.payins.get(options.payinId)
    if (payin) {
      data = { ...generateMockPayinWebhookData(), id: payin.id, status: payin.status }
    } else {
      data = { ...generateMockPayinWebhookData(), id: options.payinId }
    }
  } else {
    const generator = dataGenerators[event]
    data = generator ? generator() : { event, mock: true, timestamp: new Date().toISOString() }
  }
  await dispatchWebhook(event, data)
  return { sent: forwardUrls.length }
}
