import { describe, test, expect } from 'bun:test'
import { formatTable, formatJson, formatKeyValue, formatOutput, truncate } from '../utils/output'

describe('formatTable', () => {
  test('returns "No data found." for empty array', () => {
    const result = formatTable([])
    expect(result).toContain('No data found.')
  })

  test('renders rows with headers', () => {
    const data = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]
    const result = formatTable(data)
    expect(result).toContain('id')
    expect(result).toContain('name')
    expect(result).toContain('Alice')
    expect(result).toContain('Bob')
  })

  test('uses specified columns', () => {
    const data = [{ id: '1', name: 'Alice', secret: 'hidden' }]
    const result = formatTable(data, ['id', 'name'])
    expect(result).toContain('id')
    expect(result).toContain('name')
    expect(result).not.toContain('secret')
    expect(result).not.toContain('hidden')
  })
})

describe('formatJson', () => {
  test('formats object as JSON with indentation', () => {
    const result = formatJson({ a: 1 })
    expect(result).toBe('{\n  "a": 1\n}')
  })

  test('formats array as JSON', () => {
    const result = formatJson([1, 2])
    expect(result).toBe('[\n  1,\n  2\n]')
  })
})

describe('formatKeyValue', () => {
  test('renders key-value pairs', () => {
    const result = formatKeyValue({ id: '123', name: 'Test' })
    expect(result).toContain('id')
    expect(result).toContain('123')
    expect(result).toContain('name')
    expect(result).toContain('Test')
  })

  test('handles null values', () => {
    const result = formatKeyValue({ id: '123', optional: null })
    expect(result).toContain('id')
    expect(result).toContain('123')
  })

  test('returns (empty) for empty object', () => {
    const result = formatKeyValue({})
    expect(result).toContain('(empty)')
  })

  test('stringifies nested objects', () => {
    const result = formatKeyValue({ data: { nested: true } })
    expect(result).toContain('{"nested":true}')
  })
})

describe('formatOutput', () => {
  test('uses JSON format when json=true', () => {
    const result = formatOutput({ a: 1 }, true)
    expect(result).toBe('{\n  "a": 1\n}')
  })

  test('uses table format for arrays when json=false', () => {
    const result = formatOutput([{ id: '1' }], false)
    expect(result).toContain('id')
    expect(result).toContain('1')
  })

  test('uses key-value format for objects when json=false', () => {
    const result = formatOutput({ id: '123' }, false)
    expect(result).toContain('id')
    expect(result).toContain('123')
  })
})

describe('truncate', () => {
  test('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  test('truncates long strings with ellipsis', () => {
    expect(truncate('a very long string here', 10)).toBe('a very ...')
  })

  test('handles exact length', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })

  test('uses default max of 32', () => {
    const long = 'a'.repeat(50)
    const result = truncate(long)
    expect(result.length).toBe(32)
    expect(result).toEndWith('...')
  })
})
