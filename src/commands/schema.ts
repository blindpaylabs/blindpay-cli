interface FieldDef {
  name: string
  type: 'string' | 'number'
  required: boolean
  description: string
  default?: string
  enum?: string[]
}

interface ResourceSchema {
  resource: string
  commands: string[]
  create?: { fields: FieldDef[] }
  update?: { fields: FieldDef[] }
}

const bankDetailFields: Record<string, string[]> = {
  ach: ['beneficiary_name', 'routing_number', 'account_number', 'account_type', 'account_class'],
  wire: ['beneficiary_name', 'routing_number', 'account_number', 'address_line_1', 'city', 'state_province_region', 'country', 'postal_code'],
  rtp: ['beneficiary_name', 'routing_number', 'account_number', 'account_type', 'account_class'],
  pix: ['pix_key'],
  pix_safe: ['beneficiary_name', 'account_number', 'account_type', 'pix_safe_bank_code', 'pix_safe_branch_code', 'pix_safe_cpf_cnpj'],
  spei_bitso: ['beneficiary_name', 'spei_protocol', 'spei_clabe'],
  transfers_bitso: ['beneficiary_name', 'transfers_type', 'transfers_account'],
  ach_cop_bitso: ['ach_cop_beneficiary_first_name', 'ach_cop_beneficiary_last_name', 'ach_cop_document_id', 'ach_cop_document_type', 'ach_cop_email', 'ach_cop_bank_code', 'ach_cop_bank_account', 'account_type'],
  international_swift: ['swift_code_bic', 'swift_account_holder_name', 'swift_account_number_iban', 'swift_beneficiary_address_line_1', 'swift_beneficiary_country', 'swift_beneficiary_city', 'swift_beneficiary_state_province_region', 'swift_beneficiary_postal_code', 'swift_bank_name', 'swift_bank_address_line_1', 'swift_bank_country', 'swift_bank_city', 'swift_bank_state_province_region', 'swift_bank_postal_code'],
}

const schemas: ResourceSchema[] = [
  {
    resource: 'receivers',
    commands: ['list', 'get', 'create', 'update', 'delete'],
    create: {
      fields: [
        { name: 'email', type: 'string', required: true, description: 'Receiver email address' },
        { name: 'type', type: 'string', required: false, description: 'Receiver type', default: 'individual', enum: ['individual', 'business'] },
        { name: 'name', type: 'string', required: false, description: 'Full name (individual); auto-splits into first_name and last_name' },
        { name: 'first_name', type: 'string', required: false, description: 'First name (individual)' },
        { name: 'last_name', type: 'string', required: false, description: 'Last name (individual)' },
        { name: 'legal_name', type: 'string', required: false, description: 'Legal name (business)' },
        { name: 'country', type: 'string', required: false, description: 'ISO 3166 country code', default: 'US' },
        { name: 'tax_id', type: 'string', required: false, description: 'Tax ID' },
        { name: 'external_id', type: 'string', required: false, description: 'External reference ID' },
        { name: 'kyc_status', type: 'string', required: false, description: 'KYC verification status', default: 'approved', enum: ['verifying', 'approved', 'rejected', 'deprecated'] },
      ],
    },
    update: {
      fields: [
        { name: 'name', type: 'string', required: false, description: 'Full name (individual); auto-splits into first_name and last_name' },
        { name: 'first_name', type: 'string', required: false, description: 'First name (individual)' },
        { name: 'last_name', type: 'string', required: false, description: 'Last name (individual)' },
        { name: 'legal_name', type: 'string', required: false, description: 'Legal name (business)' },
        { name: 'email', type: 'string', required: false, description: 'Receiver email address' },
        { name: 'country', type: 'string', required: false, description: 'ISO 3166 country code' },
        { name: 'kyc_status', type: 'string', required: false, description: 'KYC verification status', enum: ['verifying', 'approved', 'rejected', 'deprecated'] },
      ],
    },
  },
  {
    resource: 'bank_accounts',
    commands: ['list', 'get', 'create', 'delete'],
    create: {
      fields: [
        { name: 'receiver_id', type: 'string', required: true, description: 'Receiver ID that owns this bank account' },
        { name: 'type', type: 'string', required: false, description: 'Bank account type / payment rail', default: 'ach', enum: Object.keys(bankDetailFields) },
        { name: 'name', type: 'string', required: false, description: 'Account display name', default: 'CLI Bank Account' },
        { name: 'beneficiary_name', type: 'string', required: false, description: 'Beneficiary name on the account' },
        { name: 'routing_number', type: 'string', required: false, description: 'Bank routing number (ACH/Wire/RTP)' },
        { name: 'account_number', type: 'string', required: false, description: 'Bank account number' },
        { name: 'account_type', type: 'string', required: false, description: 'Account type', enum: ['checking', 'saving'] },
        { name: 'account_class', type: 'string', required: false, description: 'Account class', enum: ['individual', 'business'] },
        { name: 'pix_key', type: 'string', required: false, description: 'PIX key (for PIX rail)' },
        { name: 'recipient_relationship', type: 'string', required: false, description: 'Relationship to recipient' },
        { name: 'country', type: 'string', required: false, description: 'Country code' },
      ],
    },
  },
  {
    resource: 'blockchain_wallets',
    commands: ['list', 'get', 'create', 'delete'],
    create: {
      fields: [
        { name: 'receiver_id', type: 'string', required: true, description: 'Receiver ID that owns this wallet' },
        { name: 'address', type: 'string', required: true, description: 'Blockchain wallet address' },
        { name: 'network', type: 'string', required: false, description: 'Blockchain network', default: 'base', enum: ['base', 'ethereum', 'polygon', 'solana', 'stellar', 'arbitrum', 'optimism'] },
        { name: 'external_id', type: 'string', required: false, description: 'External reference ID' },
      ],
    },
  },
  {
    resource: 'quotes',
    commands: ['create'],
    create: {
      fields: [
        { name: 'bank_account_id', type: 'string', required: true, description: 'Bank account ID for the payout destination' },
        { name: 'network', type: 'string', required: false, description: 'Blockchain network', default: 'base' },
        { name: 'token', type: 'string', required: false, description: 'Stablecoin token', default: 'USDC', enum: ['USDC', 'USDT', 'USDB'] },
        { name: 'amount', type: 'number', required: false, description: 'Amount in cents', default: '1000' },
      ],
    },
  },
  {
    resource: 'payouts',
    commands: ['list', 'get', 'create'],
    create: {
      fields: [
        { name: 'quote_id', type: 'string', required: true, description: 'Quote ID from "blindpay quotes create"' },
        { name: 'sender_wallet_address', type: 'string', required: true, description: 'Sender wallet address' },
        { name: 'network', type: 'string', required: false, description: 'Blockchain network', default: 'evm', enum: ['evm', 'solana', 'stellar'] },
      ],
    },
  },
  {
    resource: 'payin_quotes',
    commands: ['create'],
    create: {
      fields: [
        { name: 'blockchain_wallet_id', type: 'string', required: true, description: 'Blockchain wallet ID to receive funds' },
        { name: 'payment_method', type: 'string', required: true, description: 'Fiat payment method', enum: ['pix', 'ach', 'wire', 'spei', 'transfers', 'pse'] },
        { name: 'amount', type: 'number', required: false, description: 'Amount in cents', default: '1000' },
        { name: 'currency', type: 'string', required: false, description: 'Fiat currency', default: 'USD' },
      ],
    },
  },
  {
    resource: 'payins',
    commands: ['list', 'get', 'create'],
    create: {
      fields: [
        { name: 'payin_quote_id', type: 'string', required: true, description: 'Payin quote ID from "blindpay payin_quotes create"' },
        { name: 'network', type: 'string', required: false, description: 'Blockchain network', default: 'evm', enum: ['evm', 'solana', 'stellar'] },
        { name: 'external_id', type: 'string', required: false, description: 'External reference ID' },
      ],
    },
  },
  {
    resource: 'webhook_endpoints',
    commands: ['list', 'create', 'delete'],
    create: {
      fields: [
        { name: 'url', type: 'string', required: true, description: 'Webhook URL to receive events' },
        { name: 'description', type: 'string', required: false, description: 'Endpoint description' },
      ],
    },
  },
  {
    resource: 'partner_fees',
    commands: ['list', 'create', 'delete'],
    create: {
      fields: [
        { name: 'payout_percentage_fee', type: 'number', required: false, description: 'Payout percentage fee (e.g. 2.5 for 2.5%)', default: '0' },
        { name: 'payout_flat_fee', type: 'number', required: false, description: 'Payout flat fee in dollars (e.g. 1.00)', default: '0' },
        { name: 'payin_percentage_fee', type: 'number', required: false, description: 'Payin percentage fee (e.g. 2.5 for 2.5%)', default: '0' },
        { name: 'payin_flat_fee', type: 'number', required: false, description: 'Payin flat fee in dollars (e.g. 1.00)', default: '0' },
        { name: 'evm_wallet_address', type: 'string', required: false, description: 'EVM wallet address for fee collection' },
        { name: 'stellar_wallet_address', type: 'string', required: false, description: 'Stellar wallet address for fee collection' },
      ],
    },
  },
  {
    resource: 'api_keys',
    commands: ['list', 'create', 'delete'],
    create: {
      fields: [
        { name: 'name', type: 'string', required: false, description: 'API key name', default: 'CLI API Key' },
      ],
    },
  },
  {
    resource: 'virtual_accounts',
    commands: ['list', 'create'],
    create: {
      fields: [
        { name: 'receiver_id', type: 'string', required: true, description: 'Receiver ID' },
        { name: 'blockchain_wallet_id', type: 'string', required: true, description: 'Blockchain wallet ID' },
      ],
    },
  },
  {
    resource: 'offramp_wallets',
    commands: ['list'],
  },
]

export function listSchemas() {
  const summary = schemas.map(s => ({ resource: s.resource, commands: s.commands }))
  console.log(JSON.stringify(summary, null, 2))
}

export function getSchema(resource: string, rail?: string) {
  const schema = schemas.find(s => s.resource === resource)
  if (!schema) {
    const available = schemas.map(s => s.resource).join(', ')
    console.error(JSON.stringify({ error: true, message: `Unknown resource "${resource}". Available: ${available}`, exitCode: 1 }, null, 2))
    process.exit(1)
  }

  const output: Record<string, unknown> = { ...schema }

  if (resource === 'bank_accounts' && rail) {
    const fields = bankDetailFields[rail]
    if (!fields) {
      const available = Object.keys(bankDetailFields).join(', ')
      console.error(JSON.stringify({ error: true, message: `Unknown rail "${rail}". Available: ${available}`, exitCode: 1 }, null, 2))
      process.exit(1)
    }
    output.rail = rail
    output.rail_fields = fields
  }

  if (resource === 'bank_accounts' && !rail) {
    output.available_rails = Object.keys(bankDetailFields)
  }

  console.log(JSON.stringify(output, null, 2))
}
