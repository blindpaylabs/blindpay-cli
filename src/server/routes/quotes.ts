import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import { mockFxRates, accountTypeCurrencyMap } from '../../utils/constants'
import type { AvailableCurrency, Quote } from '../../types'

const app = new Hono()

function calculateQuote(
  requestAmount: number,
  currencyType: 'sender' | 'receiver',
  currency: AvailableCurrency,
  coverFees: boolean,
): { senderAmount: number; receiverAmount: number; fxRate: number } {
  const rate = mockFxRates[currency]
  const usdRate = mockFxRates.USD

  if (currency === 'USD') {
    const feeAmount = coverFees ? Math.ceil(requestAmount * 0.01) : 0
    if (currencyType === 'sender') {
      return { senderAmount: requestAmount, receiverAmount: requestAmount - feeAmount, fxRate: 100 }
    }
    return { senderAmount: requestAmount + feeAmount, receiverAmount: requestAmount, fxRate: 100 }
  }

  const fxRate = rate
  if (currencyType === 'sender') {
    const feeAmount = coverFees ? Math.ceil(requestAmount * 0.01) : 0
    const netAmount = requestAmount - feeAmount
    const receiverAmount = Math.floor(netAmount * fxRate / usdRate)
    return { senderAmount: requestAmount, receiverAmount, fxRate }
  }

  const senderAmount = Math.ceil(requestAmount * usdRate / fxRate)
  const feeAmount = coverFees ? Math.ceil(senderAmount * 0.01) : 0
  return { senderAmount: senderAmount + feeAmount, receiverAmount: requestAmount, fxRate }
}

// Create quote
app.post('/', async (c) => {
  const instanceId = param(c, 'instanceId')
  const body = await c.req.json()

  const bankAccount = store.bankAccounts.get(body.bank_account_id)
  if (!bankAccount) return c.json({ success: false, message: 'Bank account not found' }, 400)

  const currency = body.currency || accountTypeCurrencyMap[bankAccount.type as keyof typeof accountTypeCurrencyMap] || 'USD'
  const currencyType = body.currency_type || 'sender'
  const coverFees = body.cover_fees ?? true
  const requestAmount = body.request_amount

  const { senderAmount, receiverAmount, fxRate } = calculateQuote(requestAmount, currencyType, currency, coverFees)
  const now = new Date().toISOString()

  const quote: Quote = {
    id: generateId('quote'),
    request_amount: requestAmount,
    cover_fees: coverFees,
    currency_type: currencyType,
    expires_at: Math.floor(Date.now() / 1000) + 86400, // 24h for mock
    currency,
    network: body.network || 'base',
    token: body.token || 'USDC',
    commercial_quotation: fxRate,
    blindpay_quotation: Math.floor(fxRate * 0.98),
    receiver_amount: receiverAmount,
    sender_amount: senderAmount,
    description: body.description || null,
    partner_fee_amount: 0,
    flat_fee: 0,
    billing_fee: 0,
    billing_fee_amount: 0,
    transaction_fee_amount: 0,
    total_fee_amount: 0,
    bank_account_id: body.bank_account_id,
    instance_id: instanceId,
    partner_fee_id: body.partner_fee_id || null,
    contract: {
      abi: [],
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      functionName: 'approve',
      blindpayContractAddress: '0x414A2e6289cCd775F7f9EEa3bBbe02256397B153',
      amount: String(senderAmount * 10000),
      network: { name: body.network || 'Base', chainId: 8453 },
    },
    receiver_local_amount: receiverAmount,
    transaction_document_type: body.transaction_document_type || null,
    transaction_document_id: body.transaction_document_id || null,
    transaction_document_file: body.transaction_document_file || null,
    created_at: now,
    updated_at: now,
  }

  store.quotes.set(quote.id, quote)

  return c.json({
    id: quote.id,
    expires_at: quote.expires_at,
    commercial_quotation: quote.commercial_quotation,
    blindpay_quotation: quote.blindpay_quotation,
    receiver_amount: quote.receiver_amount,
    sender_amount: quote.sender_amount,
    partner_fee_amount: quote.partner_fee_amount,
    flat_fee: quote.flat_fee,
    billing_fee: quote.billing_fee,
    contract: quote.contract,
    receiver_local_amount: quote.receiver_local_amount,
    description: quote.description,
  }, 201)
})

// FX rate check
app.post('/fx', async (c) => {
  const body = await c.req.json()
  const _from = body.from || 'USDC'
  const to = body.to || 'BRL'
  const requestAmount = body.request_amount || 1000
  const currencyType = body.currency_type || 'sender'

  const fxRate = mockFxRates[to as AvailableCurrency] || 100
  const { senderAmount, receiverAmount } = calculateQuote(requestAmount, currencyType, to as AvailableCurrency, false)

  return c.json({
    commercial_quotation: fxRate,
    blindpay_quotation: Math.floor(fxRate * 0.98),
    result_amount: currencyType === 'sender' ? receiverAmount : senderAmount,
    instance_flat_fee: 0,
    instance_percentage_fee: 10,
  })
})

export default app
