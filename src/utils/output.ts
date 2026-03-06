import pc from 'picocolors'

export function formatTable(data: Record<string, any>[], columns?: string[]): string {
  if (data.length === 0)
    return pc.dim('  No data found.')

  const keys = columns || Object.keys(data[0])
  const widths = keys.map((key) => {
    const maxDataWidth = Math.max(...data.map(row => String(row[key] ?? '').length))
    return Math.max(key.length, maxDataWidth, 4)
  })

  const header = keys.map((key, i) => pc.bold(key.padEnd(widths[i]))).join('  ')
  const separator = keys.map((_, i) => pc.dim('-'.repeat(widths[i]))).join('  ')
  const rows = data.map(row =>
    keys.map((key, i) => {
      const val = row[key] ?? ''
      return String(val).padEnd(widths[i])
    }).join('  '),
  )

  return ['', `  ${header}`, `  ${separator}`, ...rows.map(r => `  ${r}`), ''].join('\n')
}

export function formatJson(data: any): string {
  return JSON.stringify(data, null, 2)
}

/** Key-value table for a single object (non-JSON human-readable get output). */
export function formatKeyValue(obj: Record<string, any>): string {
  if (obj == null || typeof obj !== 'object')
    return String(obj)
  const keys = Object.keys(obj)
  if (keys.length === 0)
    return pc.dim('  (empty)')
  const maxKey = Math.max(...keys.map(k => k.length), 4)
  const lines = keys.map((key) => {
    const val = obj[key]
    const display = val === null || val === undefined
      ? ''
      : typeof val === 'object'
        ? JSON.stringify(val)
        : String(val)
    return `  ${key.padEnd(maxKey)}  ${display}`
  })
  return ['', ...lines, ''].join('\n')
}

export function formatOutput(data: any, json: boolean, columns?: string[]): string {
  if (json)
    return formatJson(data)
  if (Array.isArray(data))
    return formatTable(data, columns)
  if (data != null && typeof data === 'object' && !Array.isArray(data))
    return formatKeyValue(data)
  return formatJson(data)
}

export function truncate(str: string, max: number = 32): string {
  if (str.length <= max)
    return str
  return `${str.slice(0, max - 3)}...`
}
