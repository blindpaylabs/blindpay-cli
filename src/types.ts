export type ReceiverType = 'individual' | 'business'
export type KycStatus = 'verifying' | 'approved' | 'rejected' | 'deprecated'
export type ReceiverKycType = 'light' | 'standard' | 'enhanced'

export type TransferType = 'wire' | 'ach' | 'pix' | 'pix_safe' | 'spei_bitso' | 'transfers_bitso' | 'ach_cop_bitso' | 'international_swift' | 'rtp'
export type BankAccountStatus = 'verifying' | 'approved' | 'rejected' | 'deprecated'
export type AccountType = 'checking' | 'saving'
export type AccountClass = 'individual' | 'business'

export type AvailableCurrency = 'BRL' | 'USD' | 'MXN' | 'COP' | 'ARS'
export type AvailableNetwork = 'base' | 'sepolia' | 'arbitrum_sepolia' | 'base_sepolia' | 'arbitrum' | 'polygon' | 'polygon_amoy' | 'ethereum' | 'stellar' | 'stellar_testnet' | 'tron' | 'solana' | 'solana_devnet'
export type AvailableToken = 'USDC' | 'USDT' | 'USDB'

export type PayoutStatus = 'processing' | 'failed' | 'refunded' | 'completed' | 'on_hold'
export type TrackingStatus = 'processing' | 'on_hold' | 'completed' | 'failed'
export type PayinStatus = 'processing' | 'failed' | 'completed'

export type PaymentMethod = 'ach' | 'wire' | 'pix' | 'spei' | 'transfers' | 'pse'

export type WebhookEvent =
  | 'receiver.new' | 'receiver.update'
  | 'bankAccount.new'
  | 'payout.new' | 'payout.update' | 'payout.complete' | 'payout.partnerFee'
  | 'blockchainWallet.new'
  | 'payin.new' | 'payin.update' | 'payin.complete' | 'payin.partnerFee'
  | 'tos.accept'
  | 'limitIncrease.new' | 'limitIncrease.update'
  | 'virtualAccount.new' | 'virtualAccount.complete'

export interface Instance {
  id: string
  name: string
  type: 'production' | 'development'
  onboarding_step: string
  subscription_plan: string | null
  subscription_status: string | null
  created_at: string
  updated_at: string
}

export interface Receiver {
  id: string
  type: ReceiverType
  kyc_type: ReceiverKycType
  kyc_status: KycStatus
  kyc_warnings: any[]
  fraud_warnings: any[]
  email: string
  tax_id: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state_province_region: string | null
  country: string
  postal_code: string | null
  ip_address: string | null
  image_url: string | null
  phone_number: string | null
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  legal_name: string | null
  alternate_name: string | null
  external_id: string | null
  instance_id: string
  tos_id: string | null
  owners: any[] | null
  created_at: string
  updated_at: string
}

export interface BankAccount {
  id: string
  type: TransferType
  name: string
  status: BankAccountStatus | null
  recipient_relationship: string | null
  pix_key: string | null
  beneficiary_name: string | null
  routing_number: string | null
  account_number: string | null
  account_type: AccountType | null
  account_class: AccountClass | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state_province_region: string | null
  country: string | null
  postal_code: string | null
  spei_protocol: string | null
  spei_clabe: string | null
  spei_institution_code: string | null
  transfers_type: string | null
  transfers_account: string | null
  ach_cop_beneficiary_first_name: string | null
  ach_cop_beneficiary_last_name: string | null
  ach_cop_document_id: string | null
  ach_cop_document_type: string | null
  ach_cop_email: string | null
  ach_cop_bank_code: string | null
  ach_cop_bank_account: string | null
  swift_code_bic: string | null
  swift_account_holder_name: string | null
  swift_account_number_iban: string | null
  swift_beneficiary_address_line_1: string | null
  swift_beneficiary_address_line_2: string | null
  swift_beneficiary_country: string | null
  swift_beneficiary_city: string | null
  swift_beneficiary_state_province_region: string | null
  swift_beneficiary_postal_code: string | null
  swift_bank_name: string | null
  swift_bank_address_line_1: string | null
  swift_bank_address_line_2: string | null
  swift_bank_country: string | null
  swift_bank_city: string | null
  swift_bank_state_province_region: string | null
  swift_bank_postal_code: string | null
  swift_intermediary_bank_swift_code_bic: string | null
  swift_intermediary_bank_account_number_iban: string | null
  swift_intermediary_bank_name: string | null
  swift_intermediary_bank_country: string | null
  pix_safe_bank_code: string | null
  pix_safe_branch_code: string | null
  pix_safe_cpf_cnpj: string | null
  tron_wallet_hash: string | null
  swift_payment_code: string | null
  receiver_id: string
  instance_id: string
  created_at: string
  updated_at: string | null
}

export interface BlockchainWallet {
  id: string
  address: string
  network: AvailableNetwork
  is_account_abstraction: boolean
  receiver_id: string
  instance_id: string
  external_id: string | null
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  request_amount: number
  cover_fees: boolean
  currency_type: 'sender' | 'receiver'
  expires_at: number
  currency: AvailableCurrency
  network: AvailableNetwork
  token: AvailableToken
  commercial_quotation: number
  blindpay_quotation: number
  receiver_amount: number
  sender_amount: number
  description: string | null
  partner_fee_amount: number
  flat_fee: number | null
  billing_fee: number | null
  billing_fee_amount: number | null
  transaction_fee_amount: number | null
  total_fee_amount: number | null
  bank_account_id: string
  instance_id: string
  partner_fee_id: string | null
  contract: any | null
  receiver_local_amount: number | null
  transaction_document_type: string | null
  transaction_document_id: string | null
  transaction_document_file: string | null
  created_at: string
  updated_at: string
}

export interface TrackingStep {
  step: TrackingStatus
  transaction_hash?: string | null
  completed_at?: string | null
  status?: string | null
  provider_name?: string | null
  provider_transaction_id?: string | null
  provider_status?: string | null
  estimated_time_of_arrival?: string | null
  recipient_name?: string | null
}

export interface Payout {
  id: string
  status: PayoutStatus
  sender_wallet_address: string
  signed_transaction: string | null
  quote_id: string
  instance_id: string
  partner_fee: number
  tracking_transaction: TrackingStep
  tracking_payment: TrackingStep
  tracking_liquidity: TrackingStep | null
  tracking_complete: TrackingStep
  tracking_partner_fee: TrackingStep | null
  tracking_documents: TrackingStep | null
  jpm_track_data: any | null
  created_at: string
  updated_at: string
}

export interface PayinQuote {
  id: string
  request_amount: number
  currency_type: 'sender' | 'receiver'
  payment_method: PaymentMethod
  currency: AvailableCurrency
  token: AvailableToken
  network: AvailableNetwork | null
  commercial_quotation: number
  blindpay_quotation: number
  receiver_amount: number
  sender_amount: number
  partner_fee_amount: number
  flat_fee: number | null
  billing_fee: number | null
  total_fee_amount: number | null
  blockchain_wallet_id: string
  instance_id: string
  partner_fee_id: string | null
  expires_at: number
  created_at: string
  updated_at: string
}

export interface Payin {
  id: string
  status: PayinStatus
  pix_code: string | null
  clabe: string | null
  payin_quote_id: string
  instance_id: string
  external_id: string | null
  partner_fee: number
  tracking_transaction: TrackingStep
  tracking_payment: TrackingStep
  tracking_complete: TrackingStep
  tracking_partner_fee: TrackingStep | null
  created_at: string
  updated_at: string
}

export interface ApiKey {
  id: string
  name: string
  key: string
  key_id: string
  permission: string
  instance_id: string
  created_at: string
  updated_at: string
}

export interface WebhookEndpoint {
  id: string
  url: string
  description: string | null
  instance_id: string
  created_at: string
  updated_at: string
}

export interface PartnerFee {
  id: string
  payin_percentage_fee: number
  payin_flat_fee: number
  payout_percentage_fee: number
  payout_flat_fee: number
  evm_wallet_address: string | null
  stellar_wallet_address: string | null
  solana_wallet_address: string | null
  instance_id: string
  created_at: string
  updated_at: string
}

export interface VirtualAccount {
  id: string
  receiver_id: string
  blockchain_wallet_id: string
  instance_id: string
  kyc_status: KycStatus
  account_number: string | null
  routing_number: string | null
  created_at: string
  updated_at: string
}

export interface OfframpWallet {
  id: string
  address: string
  network: AvailableNetwork
  external_id: string | null
  bank_account_id: string
  receiver_id: string
  instance_id: string
  created_at: string
  updated_at: string
}

export interface MockServerOptions {
  port: number
  forwardTo: string[]
  manual: boolean
  delay: number
  /** When true, skip intro/outro and minimal output (used for detached child) */
  quiet?: boolean
}
