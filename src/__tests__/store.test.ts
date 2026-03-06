import { describe, test, expect, beforeEach } from 'bun:test'
import { Store } from '../store/index'
import { MOCK_INSTANCE_ID } from '../utils/constants'
import { generateId } from '../utils/id'

describe('Store', () => {
  let store: Store

  beforeEach(() => {
    store = new Store()
  })

  test('seed data is loaded', () => {
    expect(store.instances.size).toBeGreaterThanOrEqual(1)
    expect(store.receivers.size).toBeGreaterThanOrEqual(1)
    expect(store.bankAccounts.size).toBeGreaterThanOrEqual(1)
    expect(store.blockchainWallets.size).toBeGreaterThanOrEqual(1)
    expect(store.instances.has(MOCK_INSTANCE_ID)).toBe(true)
  })

  test('listByInstance filters by instance_id', () => {
    const list = store.listByInstance(store.receivers, MOCK_INSTANCE_ID)
    expect(list.every(r => r.instance_id === MOCK_INSTANCE_ID)).toBe(true)
  })

  test('listByInstanceAndReceiver filters correctly', () => {
    const firstReceiver = store.listByInstance(store.receivers, MOCK_INSTANCE_ID)[0]
    if (!firstReceiver) return
    const accounts = store.listByInstanceAndReceiver(
      store.bankAccounts,
      MOCK_INSTANCE_ID,
      firstReceiver.id
    )
    expect(accounts.every(a => a.receiver_id === firstReceiver.id)).toBe(true)
  })

  test('paginate returns correct slice and has_more', () => {
    const items = [1, 2, 3, 4, 5]
    const result = store.paginate(items, 2, 0)
    expect(result.data).toEqual([1, 2])
    expect(result.has_more).toBe(true)
    expect(result.next_page).toBe('2')
    expect(result.prev_page).toBe(null)

    const last = store.paginate(items, 2, 4)
    expect(last.data).toEqual([5])
    expect(last.has_more).toBe(false)
    expect(last.next_page).toBe(null)
  })

  test('CRUD receiver', () => {
    const id = generateId('receiver')
    const receiver = {
      id,
      type: 'individual' as const,
      kyc_type: 'standard' as const,
      kyc_status: 'approved' as const,
      kyc_warnings: [],
      fraud_warnings: [],
      email: 'test@example.com',
      tax_id: null,
      address_line_1: null,
      address_line_2: null,
      city: null,
      state_province_region: null,
      country: 'US',
      postal_code: null,
      ip_address: null,
      image_url: null,
      phone_number: null,
      first_name: 'Test',
      last_name: 'User',
      date_of_birth: null,
      legal_name: null,
      alternate_name: null,
      external_id: null,
      instance_id: MOCK_INSTANCE_ID,
      tos_id: null,
      owners: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    store.receivers.set(id, receiver)
    expect(store.receivers.get(id)).toEqual(receiver)
    store.receivers.delete(id)
    expect(store.receivers.get(id)).toBeUndefined()
  })

  test('getSeedCounts returns counts', () => {
    const counts = store.getSeedCounts()
    expect(counts.instances).toBe(store.instances.size)
    expect(counts.receivers).toBe(store.receivers.size)
    expect(counts.bankAccounts).toBe(store.bankAccounts.size)
    expect(counts.blockchainWallets).toBe(store.blockchainWallets.size)
  })
})
