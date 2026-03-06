import type {
  Instance, Receiver, BankAccount, BlockchainWallet, Quote,
  Payout, PayinQuote, Payin, ApiKey, WebhookEndpoint, PartnerFee,
  VirtualAccount, OfframpWallet,
} from '../types'
import { seedInstance, seedReceivers, seedBankAccounts, seedBlockchainWallets, seedApiKey } from './seed'

export class Store {
  instances: Map<string, Instance> = new Map()
  receivers: Map<string, Receiver> = new Map()
  bankAccounts: Map<string, BankAccount> = new Map()
  blockchainWallets: Map<string, BlockchainWallet> = new Map()
  quotes: Map<string, Quote> = new Map()
  payouts: Map<string, Payout> = new Map()
  payinQuotes: Map<string, PayinQuote> = new Map()
  payins: Map<string, Payin> = new Map()
  apiKeys: Map<string, ApiKey> = new Map()
  webhookEndpoints: Map<string, WebhookEndpoint> = new Map()
  partnerFees: Map<string, PartnerFee> = new Map()
  virtualAccounts: Map<string, VirtualAccount> = new Map()
  offrampWallets: Map<string, OfframpWallet> = new Map()

  constructor() {
    this.seed()
  }

  private seed() {
    this.instances.set(seedInstance.id, seedInstance)
    for (const r of seedReceivers) this.receivers.set(r.id, r)
    for (const ba of seedBankAccounts) this.bankAccounts.set(ba.id, ba)
    for (const bw of seedBlockchainWallets) this.blockchainWallets.set(bw.id, bw)
    this.apiKeys.set(seedApiKey.id, seedApiKey)
  }

  listByInstance<T extends { instance_id: string }>(map: Map<string, T>, instanceId: string): T[] {
    return Array.from(map.values()).filter(item => item.instance_id === instanceId)
  }

  listByInstanceAndReceiver<T extends { instance_id: string; receiver_id: string }>(
    map: Map<string, T>, instanceId: string, receiverId: string
  ): T[] {
    return Array.from(map.values()).filter(
      item => item.instance_id === instanceId && item.receiver_id === receiverId
    )
  }

  paginate<T>(items: T[], limit: number = 50, offset: number = 0): { data: T[]; has_more: boolean; next_page: string | null; prev_page: string | null } {
    const sliced = items.slice(offset, offset + limit)
    return {
      data: sliced,
      has_more: offset + limit < items.length,
      next_page: offset + limit < items.length ? String(offset + limit) : null,
      prev_page: offset > 0 ? String(Math.max(0, offset - limit)) : null,
    }
  }

  getSeedCounts() {
    return {
      instances: this.instances.size,
      receivers: this.receivers.size,
      bankAccounts: this.bankAccounts.size,
      blockchainWallets: this.blockchainWallets.size,
    }
  }
}

export const store = new Store()
