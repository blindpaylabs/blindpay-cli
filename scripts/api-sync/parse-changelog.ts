import type { ChangelogEvent } from './types'

/**
 * Parses the exact markdown format emitted by blindpay-v2's
 * scripts/spec-diff.ts into structured events. This is a format parser,
 * not a heuristic: every pattern here corresponds 1:1 to a `lines.push(...)`
 * call in that script. If spec-diff.ts's output format ever changes, this
 * parser must fail loudly (see `parseChangelog`'s unrecognized-line check)
 * rather than silently drop events.
 */

const NEW_ENDPOINT_RE = /^- \*\*(\w+) (\S+)\*\*/
const REMOVED_ENDPOINT_RE = /^- \*\*(\w+) (\S+)\*\*\s*$/
const MODIFIED_PATH_RE = /^### (\S+)\s*$/
const NEW_METHOD_RE = /^ {2}\*\*New method: (\w+)\*\*/
const REMOVED_METHOD_RE = /^ {2}\*\*Removed method: (\w+)\*\*\s*$/
const SECTION_HEADER_RE = /^ {2}(Request body|Response) \([^)]*\) \[(\w+)\]:\s*$/
const ADDED_FIELD_RE = /^ {2}- ADDED field: (\S+) \(([^,]*(?:, [^,]*)*), (required|optional)\)\s*$/
const REMOVED_FIELD_RE = /^ {2}- REMOVED field: (\S+)\s*$/
const ENUM_FIELD_RE = /^ {2}- ENUM (\S+): (.+)$/
const TYPE_CHANGED_RE = /^ {2}- CHANGED type: (\S+): (.+)$/
const REQUIRED_CHANGED_RE = /^ {2}- CHANGED: (\S+) became (optional|required) \(was \w+\)\s*$/
const GLOBAL_ENUM_RE = /^ {2}- (\S+): (.+)$/
const NEW_SCHEMA_RE = /^- \*\*(\S+)\*\* \(\d+ fields\)\s*$/
const REMOVED_SCHEMA_RE = /^- \*\*(\S+)\*\*\s*$/

function parseValueList(text: string): string[] {
  const idx = text.indexOf(':')
  if (idx === -1)
    return []
  return text
    .slice(idx + 1)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

type Section = '## New Endpoints' | '## Removed Endpoints' | '## Modified Endpoints' | '## Enum Value Changes' | '## New Schemas' | '## Removed Schemas' | null

export function parseChangelog(markdown: string): ChangelogEvent[] {
  const events: ChangelogEvent[] = []
  const lines = markdown.split('\n')

  let section: Section = null
  let currentPath: string | null = null
  let currentMethod: string | null = null
  let currentSection: 'request' | 'response' | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      const heading = line.trim()
      if (
        heading === '## New Endpoints'
        || heading === '## Removed Endpoints'
        || heading === '## Modified Endpoints'
        || heading === '## Enum Value Changes'
        || heading === '## New Schemas'
        || heading === '## Removed Schemas'
      ) {
        section = heading as Section
      }
      else {
        // Unknown top-level section (e.g. "# API Changes" title, or a future
        // section spec-diff.ts doesn't emit yet). Reset context but don't fail:
        // only bullet lines under a recognized section are meaningful.
        section = null
      }
      currentPath = null
      currentMethod = null
      currentSection = null
      continue
    }

    if (line.trim() === '' || line.startsWith('# '))
      continue

    if (section === '## New Endpoints') {
      const m = NEW_ENDPOINT_RE.exec(line)
      if (m) {
        events.push({ kind: 'endpoint-added', method: m[1], path: m[2] })
        continue
      }
      // Sub-bullets describing the new endpoint's request/response fields
      // carry no independent information for the generator: the endpoint
      // itself is already unmappable (never in KNOWN_RESOURCES until a human
      // adds it), so its field list doesn't need separate events.
      continue
    }

    if (section === '## Removed Endpoints') {
      const m = REMOVED_ENDPOINT_RE.exec(line)
      if (m) {
        events.push({ kind: 'endpoint-removed', method: m[1], path: m[2] })
        continue
      }
      throw new Error(`parse-changelog: unrecognized line under "## Removed Endpoints": ${JSON.stringify(line)}`)
    }

    if (section === '## Modified Endpoints') {
      const pathMatch = MODIFIED_PATH_RE.exec(line)
      if (pathMatch) {
        currentPath = pathMatch[1]
        currentMethod = null
        currentSection = null
        continue
      }
      if (!currentPath)
        throw new Error(`parse-changelog: bullet before any "### /path" header: ${JSON.stringify(line)}`)

      const newMethod = NEW_METHOD_RE.exec(line)
      if (newMethod) {
        events.push({ kind: 'method-added', method: newMethod[1], path: currentPath })
        currentSection = null
        continue
      }
      const removedMethod = REMOVED_METHOD_RE.exec(line)
      if (removedMethod) {
        events.push({ kind: 'method-removed', method: removedMethod[1], path: currentPath })
        currentSection = null
        continue
      }
      const sectionHeader = SECTION_HEADER_RE.exec(line)
      if (sectionHeader) {
        currentSection = sectionHeader[1] === 'Request body' ? 'request' : 'response'
        currentMethod = sectionHeader[2]
        continue
      }
      if (!currentMethod || !currentSection)
        throw new Error(`parse-changelog: field bullet before a "Request body/Response [...]:" header: ${JSON.stringify(line)}`)

      const added = ADDED_FIELD_RE.exec(line)
      if (added) {
        events.push({
          kind: 'field-added',
          path: currentPath,
          method: currentMethod,
          section: currentSection,
          field: added[1],
          type: added[2],
          required: added[3] === 'required',
        })
        continue
      }
      const removed = REMOVED_FIELD_RE.exec(line)
      if (removed) {
        events.push({ kind: 'field-removed', path: currentPath, method: currentMethod, section: currentSection, field: removed[1] })
        continue
      }
      const enumChange = ENUM_FIELD_RE.exec(line)
      if (enumChange) {
        const field = enumChange[1]
        const rest = enumChange[2]
        const added2 = /added (\d+) values?: ([^;]*)/.exec(rest)
        const removed2 = /removed (\d+) values?: (.*)$/.exec(rest)
        events.push({
          kind: 'enum-changed',
          path: currentPath,
          method: currentMethod,
          section: currentSection,
          field,
          added: added2 ? added2[2].split(',').map(s => s.trim()).filter(Boolean) : [],
          removed: removed2 ? removed2[2].split(',').map(s => s.trim()).filter(Boolean) : [],
        })
        continue
      }
      const typeChanged = TYPE_CHANGED_RE.exec(line)
      if (typeChanged) {
        events.push({ kind: 'type-changed', path: currentPath, method: currentMethod, section: currentSection, field: typeChanged[1], detail: typeChanged[2] })
        continue
      }
      const requiredChanged = REQUIRED_CHANGED_RE.exec(line)
      if (requiredChanged) {
        events.push({ kind: 'required-changed', path: currentPath, method: currentMethod, section: currentSection, field: requiredChanged[1], detail: line.trim() })
        continue
      }
      throw new Error(`parse-changelog: unrecognized field bullet under ${currentPath} [${currentMethod}]: ${JSON.stringify(line)}`)
    }

    if (section === '## Enum Value Changes') {
      if (line.trim() === 'These enum fields gained or lost values across all schemas:')
        continue
      const m = GLOBAL_ENUM_RE.exec(line)
      if (m) {
        const field = m[1]
        const rest = m[2]
        const addedPart = /ADDED (\d+) values?: ([^;]*)/.exec(rest)
        const removedPart = /REMOVED (\d+) values?: (.*)$/.exec(rest)
        events.push({
          kind: 'global-enum-changed',
          field,
          added: addedPart ? addedPart[2].split(',').map(s => s.trim()).filter(Boolean) : [],
          removed: removedPart ? removedPart[2].split(',').map(s => s.trim()).filter(Boolean) : [],
        })
        continue
      }
      throw new Error(`parse-changelog: unrecognized line under "## Enum Value Changes": ${JSON.stringify(line)}`)
    }

    if (section === '## New Schemas') {
      const m = NEW_SCHEMA_RE.exec(line)
      if (m) {
        events.push({ kind: 'schema-added', name: m[1] })
        continue
      }
      throw new Error(`parse-changelog: unrecognized line under "## New Schemas": ${JSON.stringify(line)}`)
    }

    if (section === '## Removed Schemas') {
      const m = REMOVED_SCHEMA_RE.exec(line)
      if (m) {
        events.push({ kind: 'schema-removed', name: m[1] })
        continue
      }
      throw new Error(`parse-changelog: unrecognized line under "## Removed Schemas": ${JSON.stringify(line)}`)
    }

    // A bullet outside any recognized section (e.g. malformed changelog,
    // or a section this parser doesn't know about yet). Fail loud per the
    // honest-failure requirement instead of silently ignoring content.
    if (line.trim().startsWith('-') && section === null)
      throw new Error(`parse-changelog: bullet outside any recognized section: ${JSON.stringify(line)}`)
  }

  return events
}

// Re-export the value-list helper for tests that want to exercise it in
// isolation without depending on the full parser.
export { parseValueList }
