/**
 * The deterministic generator's entire "what can I touch" surface.
 *
 * Each entry maps a schema.ts `resource` name to the exact OpenAPI path(s)
 * whose request body corresponds to that resource's `create`/`update`
 * field list. Multiple paths for the same operation are aliases that share
 * one request schema (e.g. the API exposes both /receivers and /customers
 * for the same underlying resource) — a change reported on any alias path
 * is treated as one event for the resource.
 *
 * A path NOT listed here is, by construction, unmappable: the classifier
 * in classify.ts routes any changelog event on an unlisted path straight
 * to the "needs a human" bucket. This is intentional — new commands and
 * new top-level resources always require hand-written wiring in
 * src/index.ts and src/commands/resources.ts, which this generator does
 * not touch. Extending this map to a genuinely new resource is itself a
 * hand-written change to make deliberately, not something to automate.
 */

export interface OperationRef {
  /** OpenAPI path templates that alias the same request schema. */
  paths: string[]
  method: 'post' | 'put'
  /**
   * Exported function name in src/commands/resources.ts that builds this
   * request body. The generator locates this function by name and never
   * guesses it from the resource name, since a handful of resources
   * (customers/receivers) alias to non-obvious function names.
   */
  fn: string
}

export interface KnownResource {
  /** Matches `resource` in src/commands/schema.ts. */
  resource: string
  create?: OperationRef
  update?: OperationRef
}

export const KNOWN_RESOURCES: KnownResource[] = [
  {
    resource: 'customers',
    create: {
      method: 'post',
      fn: 'createCustomer',
      paths: [
        '/v1/instances/{instance_id}/customers',
        '/v1/instances/{instance_id}/receivers',
      ],
    },
    update: {
      method: 'put',
      fn: 'updateCustomer',
      paths: [
        '/v1/instances/{instance_id}/customers/{id}',
        '/v1/instances/{instance_id}/receivers/{id}',
      ],
    },
  },
  {
    resource: 'bank_accounts',
    create: {
      method: 'post',
      fn: 'createBankAccount',
      paths: [
        '/v1/instances/{instance_id}/customers/{customer_id}/bank-accounts',
        '/v1/instances/{instance_id}/receivers/{receiver_id}/bank-accounts',
      ],
    },
  },
  {
    resource: 'blockchain_wallets',
    create: {
      method: 'post',
      fn: 'createBlockchainWallet',
      paths: [
        '/v1/instances/{instance_id}/customers/{customer_id}/blockchain-wallets',
        '/v1/instances/{instance_id}/receivers/{receiver_id}/blockchain-wallets',
      ],
    },
  },
  {
    resource: 'quotes',
    create: {
      method: 'post',
      fn: 'createQuote',
      paths: ['/v1/instances/{instance_id}/quotes'],
    },
  },
  {
    resource: 'payin_quotes',
    create: {
      method: 'post',
      fn: 'createPayinQuote',
      paths: ['/v1/instances/{instance_id}/payin-quotes'],
    },
  },
  {
    resource: 'webhook_endpoints',
    create: {
      method: 'post',
      fn: 'createWebhookEndpoint',
      paths: ['/v1/instances/{instance_id}/webhook-endpoints'],
    },
  },
  {
    resource: 'partner_fees',
    create: {
      method: 'post',
      fn: 'createPartnerFee',
      paths: ['/v1/instances/{instance_id}/partner-fees'],
    },
  },
  {
    resource: 'virtual_accounts',
    create: {
      method: 'post',
      fn: 'createVirtualAccount',
      paths: [
        '/v1/instances/{instance_id}/customers/{customer_id}/virtual-accounts',
        '/v1/instances/{instance_id}/receivers/{receiver_id}/virtual-accounts',
      ],
    },
  },
  // `api_keys` was removed from the CLI (PR #17) after the API dropped the
  // feature from the CLI-relevant surface; deliberately no entry here.
  // `payouts` and `payins` deliberately have NO entry: schema.ts models
  // them with a single generic `network` field abstracting over the
  // network-specific endpoints (POST .../payouts/evm|solana|stellar,
  // POST .../payins/evm). That abstraction is a hand-curated union, not a
  // 1:1 mapping to one request schema, so field/enum diffs on any of
  // those paths are intentionally routed to the needs-human bucket.
  // `offramp_wallets` has no `create` in the CLI schema (list-only today)
  // so it is likewise omitted.
]

export function findKnownResourceByPath(path: string): { resource: string, op: 'create' | 'update', fn: string } | null {
  for (const kr of KNOWN_RESOURCES) {
    if (kr.create?.paths.includes(path))
      return { resource: kr.resource, op: 'create', fn: kr.create.fn }
    if (kr.update?.paths.includes(path))
      return { resource: kr.resource, op: 'update', fn: kr.update.fn }
  }
  return null
}
