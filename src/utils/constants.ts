import type { AvailableCurrency, AvailableNetwork, AvailableToken, TransferType, PaymentMethod, WebhookEvent } from '../types'

export const CLI_VERSION = '0.1.0'
export const DEFAULT_API_URL = 'https://api.blindpay.com'
export const MOCK_INSTANCE_ID = 'in_mock00000001'

export const webhookEvents: WebhookEvent[] = [
  'receiver.new',
  'receiver.update',
  'bankAccount.new',
  'payout.new',
  'payout.update',
  'payout.complete',
  'payout.partnerFee',
  'blockchainWallet.new',
  'payin.new',
  'payin.update',
  'payin.complete',
  'payin.partnerFee',
  'tos.accept',
  'limitIncrease.new',
  'limitIncrease.update',
  'virtualAccount.new',
  'virtualAccount.complete',
]

/** Deterministic Svix-format secret for local webhook verification (whsec_<base64>) */
export const WEBHOOK_SIGNING_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'

export const mockFxRates: Record<AvailableCurrency, number> = {
  USD: 100,
  BRL: 550,
  MXN: 1720,
  COP: 420000,
  ARS: 97500,
}

export const accountTypeCurrencyMap: Record<TransferType, AvailableCurrency> = {
  ach: 'USD',
  wire: 'USD',
  pix: 'BRL',
  pix_safe: 'BRL',
  ach_cop_bitso: 'COP',
  spei_bitso: 'MXN',
  transfers_bitso: 'ARS',
  international_swift: 'USD',
  rtp: 'USD',
}

export const paymentMethodCurrencyMap: Record<PaymentMethod, AvailableCurrency> = {
  ach: 'USD',
  wire: 'USD',
  pix: 'BRL',
  spei: 'MXN',
  transfers: 'ARS',
  pse: 'COP',
}

export const availableNetworksOnDev: AvailableNetwork[] = ['sepolia', 'arbitrum_sepolia', 'base_sepolia', 'polygon_amoy', 'stellar_testnet', 'solana_devnet']
export const availableNetworksOnProd: AvailableNetwork[] = ['base', 'arbitrum', 'polygon', 'ethereum', 'stellar', 'solana']
export const availableTokensOnDev: AvailableToken[] = ['USDB']
export const availableTokensOnProd: AvailableToken[] = ['USDC', 'USDT']

export const transferTypeEtaMap: Record<TransferType, string> = {
  wire: '1_business_day',
  ach: '2_business_days',
  pix: '5_min',
  pix_safe: '5_min',
  spei_bitso: '5_min',
  transfers_bitso: '5_min',
  ach_cop_bitso: '1_business_day',
  international_swift: '5_business_days',
  rtp: '5_min',
}

export const developmentFees = {
  ach: { payin_flat: 40, payin_percentage: 10, payout_flat: 40, payout_percentage: 10 },
  domestic_wire: { payin_flat: 1500, payin_percentage: 10, payout_flat: 1500, payout_percentage: 10 },
  rtp: { payin_flat: 100, payin_percentage: 10, payout_flat: 100, payout_percentage: 10 },
  international_swift: { payin_flat: 4500, payin_percentage: 10, payout_flat: 4500, payout_percentage: 10 },
  pix: { payin_flat: 10, payin_percentage: 10, payout_flat: 10, payout_percentage: 10 },
  pix_safe: { payin_flat: 10, payin_percentage: 10, payout_flat: 10, payout_percentage: 10 },
  ach_colombia: { payin_flat: 100, payin_percentage: 10, payout_flat: 100, payout_percentage: 10 },
  transfers_3: { payin_flat: 50, payin_percentage: 10, payout_flat: 50, payout_percentage: 10 },
  spei: { payin_flat: 50, payin_percentage: 10, payout_flat: 50, payout_percentage: 10 },
  tron: { payin_flat: 1500, payin_percentage: 0, payout_flat: 1500, payout_percentage: 0 },
  ethereum: { payin_flat: 50, payin_percentage: 0, payout_flat: 50, payout_percentage: 0 },
  polygon: { payin_flat: 0, payin_percentage: 0, payout_flat: 0, payout_percentage: 0 },
  base: { payin_flat: 0, payin_percentage: 0, payout_flat: 0, payout_percentage: 0 },
  arbitrum: { payin_flat: 0, payin_percentage: 0, payout_flat: 0, payout_percentage: 0 },
  stellar: { payin_flat: 0, payin_percentage: 0, payout_flat: 0, payout_percentage: 0 },
  solana: { payin_flat: 0, payin_percentage: 0, payout_flat: 0, payout_percentage: 0 },
}

export const availableRails = [
  { type: 'ach', currency: 'USD', country: 'US', name: 'ACH' },
  { type: 'wire', currency: 'USD', country: 'US', name: 'Domestic Wire' },
  { type: 'rtp', currency: 'USD', country: 'US', name: 'RTP' },
  { type: 'pix', currency: 'BRL', country: 'BR', name: 'PIX' },
  { type: 'pix_safe', currency: 'BRL', country: 'BR', name: 'PIX Safe' },
  { type: 'spei_bitso', currency: 'MXN', country: 'MX', name: 'SPEI' },
  { type: 'transfers_bitso', currency: 'ARS', country: 'AR', name: 'Transfers 3.0' },
  { type: 'ach_cop_bitso', currency: 'COP', country: 'CO', name: 'ACH Colombia' },
  { type: 'international_swift', currency: 'USD', country: 'INTL', name: 'International SWIFT' },
]
