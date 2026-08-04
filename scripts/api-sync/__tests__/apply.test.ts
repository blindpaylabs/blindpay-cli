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

  // Regression: createQuote's body starts as a plain object literal
  // (`const body = {...}`), not `Record<string, any>`. Assigning a new key
  // to it after the fact doesn't typecheck (TS2339), which is exactly what
  // broke CI when this generator added refund_wallet_address to it.
  test('widens an untyped "const body = {" to Record<string, any> so the new field assignment typechecks', () => {
    const change: ApplicableChange = { resource: 'quotes', op: 'create', fn: 'createQuote', field: 'refund_wallet_address', type: 'string', required: false }
    const patched = applyResourcesField(real('src/commands/resources.ts'), change)
    const fnStart = patched.indexOf('export async function createQuote(')
    const fnRegion = patched.slice(fnStart, patched.indexOf('export async function', fnStart + 1))
    expect(fnRegion).toContain('const body: Record<string, any> = {')
    expect(fnRegion).toContain('if (options.refundWalletAddress !== undefined) body.refund_wallet_address = options.refundWalletAddress')
  })

  test('leaves an already-typed "const body: Record<string, any> =" untouched', () => {
    const change: ApplicableChange = { resource: 'bank_accounts', op: 'create', fn: 'createBankAccount', field: 'clabe', type: 'string', required: false }
    const patched = applyResourcesField(real('src/commands/resources.ts'), change)
    const fnStart = patched.indexOf('export async function createBankAccount(')
    const fnRegion = patched.slice(fnStart, patched.indexOf('export async function', fnStart + 1))
    expect(fnRegion).not.toContain('Record<string, any> = Record<string, any>')
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
    const inserted = patched.split('\n').find(l => l.includes("name: 'clabe'"))
    expect(inserted).toBeDefined()
    // The inserted line must sit at the same indent as its sibling FieldDefs, not at
    // the shallower indent of the closing bracket it was anchored on.
    const sibling = patched.split('\n').find(l => l.includes("name: '") && !l.includes('clabe'))
    expect(inserted!.match(/^\s*/)![0]).toBe(sibling!.match(/^\s*/)![0])
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
