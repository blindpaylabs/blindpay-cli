import { Hono } from 'hono'
import { param } from '../../utils/hono'
import { store } from '../../store/index'
import { generateId } from '../../utils/id'
import { mockFxRates, paymentMethodCurrencyMap } from '../../utils/constants'
import type { AvailableCurrency, PayinQuote, PaymentMethod } from '../../types'

const app = new Hono()

// Create payin quote
app.post('/', async (c) => {
  const instanceId = param(c, 'instanceId')
  const body = await c.req.json()

  const wallet = store.blockchainWallets.get(body.blockchain_wallet_id)
  if (!wallet) return c.json({ success: false, message: 'Blockchain wallet not found' }, 400)

  const paymentMethod: PaymentMethod = body.payment_method || 'pix'
  const currency = paymentMethodCurrencyMap[paymentMethod] || 'USD'
  const requestAmount = body.request_amount || 1000
  const currencyType = body.currency_type || 'sender'

  const fxRate = mockFxRates[currency]
  const usdRate = mockFxRates.USD

  let senderAmount: number
  let receiverAmount: number

  if (currency === 'USD') {
    senderAmount = currencyType === 'sender' ? requestAmount : requestAmount
    receiverAmount = currencyType === 'sender' ? requestAmount : requestAmount
  } else {
    if (currencyType === 'sender') {
      senderAmount = requestAmount
      receiverAmount = Math.floor(requestAmount * usdRate / fxRate)
    } else {
      receiverAmount = requestAmount
      senderAmount = Math.ceil(requestAmount * fxRate / usdRate)
    }
  }

  const now = new Date().toISOString()
  const quote: PayinQuote = {
    id: generateId('payinQuote'),
    request_amount: requestAmount,
    currency_type: currencyType,
    payment_method: paymentMethod,
    currency,
    token: body.token || 'USDC',
    network: wallet.network,
    commercial_quotation: fxRate,
    blindpay_quotation: Math.floor(fxRate * 0.98),
    receiver_amount: receiverAmount,
    sender_amount: senderAmount,
    partner_fee_amount: 0,
    flat_fee: 0,
    billing_fee: 0,
    total_fee_amount: 0,
    blockchain_wallet_id: body.blockchain_wallet_id,
    instance_id: instanceId,
    partner_fee_id: body.partner_fee_id || null,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    created_at: now,
    updated_at: now,
  }

  store.payinQuotes.set(quote.id, quote)

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
    currency: quote.currency,
    payment_method: quote.payment_method,
  }, 201)
})

// FX rate check
app.post('/fx', async (c) => {
  const body = await c.req.json()
  const from = body.from || 'BRL'
  const _to = body.to || 'USDC'
  const requestAmount = body.request_amount || 1000
  const currencyType = body.currency_type || 'sender'

  const fxRate = mockFxRates[from as AvailableCurrency] || 100
  const usdRate = mockFxRates.USD

  let resultAmount: number
  if (currencyType === 'sender') {
    resultAmount = Math.floor(requestAmount * usdRate / fxRate)
  } else {
    resultAmount = Math.ceil(requestAmount * fxRate / usdRate)
  }

  return c.json({
    commercial_quotation: fxRate,
    blindpay_quotation: Math.floor(fxRate * 0.98),
    result_amount: resultAmount,
    instance_flat_fee: 0,
    instance_percentage_fee: 10,
  })
})

export default app
