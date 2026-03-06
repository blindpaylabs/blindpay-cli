import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { availableRails } from '../../utils/constants'

const app = new Hono()

// Get available rails
app.get('/rails', (c) => {
  return c.json({ data: availableRails })
})

// Get bank details by rail
app.get('/bank-details', (c) => {
  const rail = c.req.query('rail')
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
  return c.json({ fields: rail ? (fields[rail] || []) : fields })
})

// Get NAICS list
app.get('/naics', (c) => {
  return c.json({
    data: [
      { code: '541511', name: 'Custom Computer Programming Services' },
      { code: '541512', name: 'Computer Systems Design Services' },
      { code: '511210', name: 'Software Publishers' },
      { code: '522110', name: 'Commercial Banking' },
      { code: '454110', name: 'Electronic Shopping and Mail-Order Houses' },
    ],
  })
})

// Get SWIFT code details
app.get('/swift/:swift', (c) => {
  const swift = param(c, 'swift')
  return c.json({
    swift_code: swift,
    bank_name: 'Mock Bank',
    city: 'New York',
    country: 'US',
    address: '123 Mock Street',
  })
})

export default app
