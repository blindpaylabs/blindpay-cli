import { describe, expect, test } from 'bun:test'
import { classify } from '../classify'
import type { ChangelogEvent } from '../types'

describe('classify', () => {
  test('routes a request-field addition on a known resource path to applicable', () => {
    const events: ChangelogEvent[] = [
      {
        kind: 'field-added',
        path: '/v1/instances/{instance_id}/customers/{customer_id}/bank-accounts',
        method: 'POST',
        section: 'request',
        field: 'swift_ifsc_branch_code',
        type: 'string',
        required: false,
      },
    ]
    const { applicable, needsHuman } = classify(events)
    expect(applicable).toEqual([
      { resource: 'bank_accounts', op: 'create', fn: 'createBankAccount', field: 'swift_ifsc_branch_code', type: 'string', required: false },
    ])
    expect(needsHuman).toEqual([])
  })

  test('routes a request-field addition on an unknown path to needs-human', () => {
    const events: ChangelogEvent[] = [
      { kind: 'field-added', path: '/v1/instances/{instance_id}/transfers', method: 'POST', section: 'request', field: 'memo', type: 'string', required: false },
    ]
    const { applicable, needsHuman } = classify(events)
    expect(applicable).toEqual([])
    expect(needsHuman).toHaveLength(1)
  })

  test('routes response field additions, removals, enum changes, and endpoint/schema churn to needs-human', () => {
    const events: ChangelogEvent[] = [
      { kind: 'field-added', path: '/v1/instances/{instance_id}/customers', method: 'POST', section: 'response', field: 'risk_score', type: 'number', required: false },
      { kind: 'field-removed', path: '/v1/instances/{instance_id}/customers', method: 'POST', section: 'request', field: 'kyc_status' },
      { kind: 'enum-changed', path: '/v1/instances/{instance_id}/customers', method: 'POST', section: 'request', field: 'kyc_type', added: ['enhanced_plus'], removed: [] },
      { kind: 'global-enum-changed', field: 'network', added: ['avalanche'], removed: [] },
      { kind: 'endpoint-added', method: 'POST', path: '/v1/instances/{instance_id}/transfers' },
      { kind: 'endpoint-removed', method: 'DELETE', path: '/v1/instances/{instance_id}/api-keys/{id}' },
      { kind: 'method-added', method: 'PUT', path: '/v1/instances/{instance_id}/quotes' },
      { kind: 'method-removed', method: 'DELETE', path: '/v1/instances/{instance_id}/quotes' },
      { kind: 'schema-added', name: 'TransferBody' },
      { kind: 'schema-removed', name: 'ApiKeyBody' },
      { kind: 'type-changed', path: '/v1/instances/{instance_id}/customers', method: 'POST', section: 'request', field: 'tax_id', detail: 'string -> number' },
      { kind: 'required-changed', path: '/v1/instances/{instance_id}/customers', method: 'POST', section: 'request', field: 'email', detail: 'email became optional' },
    ]
    const { applicable, needsHuman } = classify(events)
    expect(applicable).toEqual([])
    expect(needsHuman).toHaveLength(events.length)
  })
})
