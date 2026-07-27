import { describe, expect, test } from 'bun:test'
import { parseChangelog } from '../parse-changelog'

describe('parseChangelog', () => {
  test('parses an added request field on a modified endpoint', () => {
    const md = `# API Changes (SDK-relevant)

## Modified Endpoints

### /v1/instances/{instance_id}/customers/{customer_id}/bank-accounts

  Request body (CreateBankAccountBody) [POST]:
  - ADDED field: swift_ifsc_branch_code (string, optional)
`
    const events = parseChangelog(md)
    expect(events).toEqual([
      {
        kind: 'field-added',
        path: '/v1/instances/{instance_id}/customers/{customer_id}/bank-accounts',
        method: 'POST',
        section: 'request',
        field: 'swift_ifsc_branch_code',
        type: 'string',
        required: false,
      },
    ])
  })

  test('parses removed field, enum change, new/removed endpoints and schemas', () => {
    const md = `# API Changes (SDK-relevant)

## New Endpoints

- **POST /v1/instances/{instance_id}/transfers** — Create a transfer

## Removed Endpoints

- **DELETE /v1/instances/{instance_id}/api-keys/{id}**

## Modified Endpoints

### /v1/instances/{instance_id}/customers

  Request body (CreateCustomerBody) [POST]:
  - REMOVED field: kyc_status
  - ENUM kyc_type: added 1 values: enhanced_plus

## Enum Value Changes

These enum fields gained or lost values across all schemas:

  - network: ADDED 1 values: avalanche; REMOVED 1 values: legacy_chain

## New Schemas

- **TransferBody** (3 fields)

## Removed Schemas

- **ApiKeyBody**
`
    const events = parseChangelog(md)
    expect(events).toContainEqual({ kind: 'endpoint-added', method: 'POST', path: '/v1/instances/{instance_id}/transfers' })
    expect(events).toContainEqual({ kind: 'endpoint-removed', method: 'DELETE', path: '/v1/instances/{instance_id}/api-keys/{id}' })
    expect(events).toContainEqual({
      kind: 'field-removed',
      path: '/v1/instances/{instance_id}/customers',
      method: 'POST',
      section: 'request',
      field: 'kyc_status',
    })
    expect(events).toContainEqual({
      kind: 'enum-changed',
      path: '/v1/instances/{instance_id}/customers',
      method: 'POST',
      section: 'request',
      field: 'kyc_type',
      added: ['enhanced_plus'],
      removed: [],
    })
    expect(events).toContainEqual({
      kind: 'global-enum-changed',
      field: 'network',
      added: ['avalanche'],
      removed: ['legacy_chain'],
    })
    expect(events).toContainEqual({ kind: 'schema-added', name: 'TransferBody' })
    expect(events).toContainEqual({ kind: 'schema-removed', name: 'ApiKeyBody' })
  })

  test('fails loudly on an unrecognized bullet instead of silently dropping it', () => {
    const md = `# API Changes (SDK-relevant)

## Modified Endpoints

### /v1/instances/{instance_id}/customers

  Request body (X) [POST]:
  - SOMETHING WEIRD: kyc_status
`
    expect(() => parseChangelog(md)).toThrow()
  })

  test('returns no events for an empty changelog', () => {
    expect(parseChangelog('# API Changes (SDK-relevant)\n')).toEqual([])
  })
})
