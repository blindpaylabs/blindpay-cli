import { customAlphabet } from 'nanoid'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const generate = customAlphabet(alphabet, 12)

const prefixes = {
  instance: 'in',
  receiver: 're',
  bankAccount: 'ba',
  blockchainWallet: 'bw',
  quote: 'qu',
  payout: 'pa',
  payinQuote: 'pq',
  payin: 'pi',
  apiKey: 'ak',
  webhookEndpoint: 'we',
  partnerFee: 'pf',
  virtualAccount: 'va',
  offrampWallet: 'ow',
  receiverOwner: 'ub',
} as const

export type ResourceType = keyof typeof prefixes

export function generateId(resource: ResourceType): string {
  return `${prefixes[resource]}_${generate()}`
}
