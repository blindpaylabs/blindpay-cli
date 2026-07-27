import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { applyIndexOption, applyResourcesField, applySchemaField } from '../apply'
import type { ApplicableChange } from '../classify'

const ROOT = join(import.meta.dir, '../../..')

function real(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8')
}

describe('applyResourcesField', () => {
  test('adds a new optional field to createBankAccount, mirroring PR #6', () => {
    const change: ApplicableChange = { resource: 'bank_accounts', op: 'create', fn: 'createBankAccount', field: 'clabe', type: 'string', required: false }
    const patched = applyResourcesField(real('src/commands/resources.ts'), change)
    expect(patched).toContain('clabe?: string')
    expect(patched).toContain('if (options.clabe !== undefined) body.clabe = options.clabe')
    // Property inserted before the json prop, inside createBankAccount only.
    const fnStart = patched.indexOf('export async function createBankAccount(')
    const fnRegion = patched.slice(fnStart, patched.indexOf('export async function', fnStart + 1))
    expect(fnRegion).toContain('clabe?: string')
  })

  test('is idempotent: applying the same change twice produces the same output', () => {
    const change: ApplicableChange = { resource: 'bank_accounts', op: 'create', fn: 'createBankAccount', field: 'clabe', type: 'string', required: false }
    const once = applyResourcesField(real('src/commands/resources.ts'), change)
    const twice = applyResourcesField(once, change)
    expect(twice).toBe(once)
  })

  test('adds a new optional field to updateCustomer (multi-line options signature)', () => {
    const change: ApplicableChange = { resource: 'customers', op: 'update', fn: 'updateCustomer', field: 'external_id', type: 'string', required: false }
    const patched = applyResourcesField(real('src/commands/resources.ts'), change)
    expect(patched).toContain('externalId?: string')
    expect(patched).toContain('if (options.externalId !== undefined) body.external_id = options.externalId')
  })
})

describe('applyIndexOption', () => {
  test('adds a new --clabe option right before --json on the bank_accounts create command', () => {
    const change: ApplicableChange = { resource: 'bank_accounts', op: 'create', fn: 'createBankAccount', field: 'clabe', type: 'string', required: false }
    const patched = applyIndexOption(real('src/index.ts'), change)
    const lines = patched.split('\n')
    const jsonIdx = lines.findIndex(l => l.includes("createBankAccount(opts))"))
    const clabeIdx = lines.findIndex(l => l.includes("--clabe <value>"))
    expect(clabeIdx).toBeGreaterThan(-1)
    expect(clabeIdx).toBeLessThan(jsonIdx)
  })

  test('is idempotent', () => {
    const change: ApplicableChange = { resource: 'bank_accounts', op: 'create', fn: 'createBankAccount', field: 'clabe', type: 'string', required: false }
    const once = applyIndexOption(real('src/index.ts'), change)
    const twice = applyIndexOption(once, change)
    expect(twice).toBe(once)
  })
})

describe('applySchemaField', () => {
  test('adds a FieldDef to the bank_accounts create fields array', () => {
    const change: ApplicableChange = { resource: 'bank_accounts', op: 'create', fn: 'createBankAccount', field: 'clabe', type: 'string', required: false }
    const patched = applySchemaField(real('src/commands/schema.ts'), change)
    expect(patched).toContain("name: 'clabe'")
  })

  test('is idempotent', () => {
    const change: ApplicableChange = { resource: 'bank_accounts', op: 'create', fn: 'createBankAccount', field: 'clabe', type: 'string', required: false }
    const once = applySchemaField(real('src/commands/schema.ts'), change)
    const twice = applySchemaField(once, change)
    expect(twice).toBe(once)
  })

  test('throws (needs-human) for an op/resource with no matching block, instead of guessing', () => {
    const change: ApplicableChange = { resource: 'webhook_endpoints', op: 'update' as any, fn: 'updateWebhookEndpoint', field: 'x', type: 'string', required: false }
    expect(() => applySchemaField(real('src/commands/schema.ts'), change)).toThrow()
  })
})
