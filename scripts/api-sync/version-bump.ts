import type { ChangelogEvent } from './types'

export type BumpType = 'minor' | 'patch'

/**
 * Minor if the spec diff added/removed any command-shaped surface (an
 * endpoint, a method on an existing path) or any enum value anywhere;
 * patch otherwise. Matches the owner's stated rule and mirrors the
 * equivalent decision in blindpay-mcp's derive-version-bump.ts, adapted to
 * the events this repo's changelog format actually carries.
 */
export function deriveVersionBump(events: ChangelogEvent[]): { type: BumpType, reasons: string[] } {
  const reasons: string[] = []

  for (const e of events) {
    switch (e.kind) {
      case 'endpoint-added':
        reasons.push(`endpoint added: ${e.method} ${e.path}`)
        break
      case 'endpoint-removed':
        reasons.push(`endpoint removed: ${e.method} ${e.path}`)
        break
      case 'method-added':
        reasons.push(`method added: ${e.method} ${e.path}`)
        break
      case 'method-removed':
        reasons.push(`method removed: ${e.method} ${e.path}`)
        break
      case 'enum-changed':
        if (e.added.length) reasons.push(`enum values added on ${e.field} (${e.method} ${e.path}): ${e.added.join(', ')}`)
        if (e.removed.length) reasons.push(`enum values removed on ${e.field} (${e.method} ${e.path}): ${e.removed.join(', ')}`)
        break
      case 'global-enum-changed':
        if (e.added.length) reasons.push(`enum values added on ${e.field}: ${e.added.join(', ')}`)
        if (e.removed.length) reasons.push(`enum values removed on ${e.field}: ${e.removed.join(', ')}`)
        break
      default:
        break
    }
  }

  return { type: reasons.length > 0 ? 'minor' : 'patch', reasons }
}

export function bumpVersion(currentVersion: string, type: BumpType): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(currentVersion)
  if (!match)
    throw new Error(`Cannot parse semver version "${currentVersion}".`)
  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3])
  return type === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`
}
