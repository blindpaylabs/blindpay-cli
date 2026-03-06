export const CLI_VERSION = '0.1.0'
export const DEFAULT_API_URL = 'https://api.blindpay.com'

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
