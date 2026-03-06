import { describe, test, expect } from 'bun:test'
import { generateId, type ResourceType } from '../utils/id'

describe('generateId', () => {
  const types: ResourceType[] = [
    'instance', 'receiver', 'bankAccount', 'blockchainWallet', 'quote',
    'payout', 'payinQuote', 'payin', 'apiKey', 'webhookEndpoint', 'partnerFee',
    'virtualAccount', 'offrampWallet', 'receiverOwner',
  ]

  test.each(types)('generates id with prefix for %s', (resource) => {
    const id = generateId(resource)
    const prefix = id.slice(0, 3)
    expect(id).toMatch(/^[a-z]{2}_[A-Za-z0-9]{12}$/)
    if (resource === 'instance') expect(prefix).toBe('in_')
    if (resource === 'receiver') expect(prefix).toBe('re_')
    if (resource === 'bankAccount') expect(prefix).toBe('ba_')
    if (resource === 'blockchainWallet') expect(prefix).toBe('bw_')
    if (resource === 'quote') expect(prefix).toBe('qu_')
    if (resource === 'payout') expect(prefix).toBe('pa_')
    if (resource === 'payin') expect(prefix).toBe('pi_')
  })

  test('generates unique ids', () => {
    const set = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const id = generateId('receiver')
      expect(set.has(id)).toBe(false)
      set.add(id)
    }
  })
})
