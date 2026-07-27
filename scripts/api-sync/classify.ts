import type { ChangelogEvent, FieldChangeEvent } from './types'
import { findKnownResourceByPath } from './known-resources'

/**
 * A field-added event on the REQUEST body of a create/update path this
 * generator recognizes. This is the entire CAN-express surface today:
 * one new optional CLI flag, passed through verbatim to the request body,
 * mirrors exactly how every historical additive api-sync PR touched this
 * codebase (e.g. #6's `swift_ifsc_branch_code`).
 *
 * Deliberately NOT expressed by the generator (routed to needs-human
 * instead), even though a human syncing the CLI by hand might handle them
 * mechanically too:
 *   - field-removed: removing a flag can break scripts already depending on
 *     it; that's a judgment call, not a mechanical one.
 *   - response-only field/enum changes: whether to surface a new response
 *     field as a table column is explicitly a "when in doubt" judgment call
 *     in CLAUDE.md, not a deterministic rule.
 *   - enum-changed / global-enum-changed: CLAUDE.md says "update help text
 *     only" for these, but there is no stable anchor for what the help text
 *     currently says, so it can't be regenerated safely by a script.
 *   - endpoint/method/schema added or removed: always needs hand-written
 *     command wiring (or removal) in src/index.ts.
 */
export interface ApplicableChange {
  resource: string
  op: 'create' | 'update'
  fn: string
  field: string
  type?: string
  required?: boolean
}

export interface ClassifyResult {
  applicable: ApplicableChange[]
  needsHuman: string[]
}

export function classify(events: ChangelogEvent[]): ClassifyResult {
  const applicable: ApplicableChange[] = []
  const needsHuman: string[] = []

  for (const event of events) {
    switch (event.kind) {
      case 'field-added': {
        const fe = event as FieldChangeEvent
        if (fe.section !== 'request') {
          needsHuman.push(`Response field added on ${fe.method} ${fe.path}: "${fe.field}" — whether to surface it as a CLI output column is a judgment call (CLAUDE.md), not scripted.`)
          break
        }
        const known = findKnownResourceByPath(fe.path)
        if (!known) {
          needsHuman.push(`Field "${fe.field}" added to the request body of ${fe.method} ${fe.path}, a path this generator does not recognize. Needs a human to decide the CLI surface (new command, or extend known-resources.ts).`)
          break
        }
        applicable.push({ resource: known.resource, op: known.op, fn: known.fn, field: fe.field, type: fe.type, required: fe.required })
        break
      }
      case 'field-removed': {
        const fe = event
        needsHuman.push(`Field "${fe.field}" removed from the request body of ${fe.method} ${fe.path} (${fe.section}). Removing a CLI flag is a breaking change for scripts using it and needs a human call.`)
        break
      }
      case 'enum-changed': {
        needsHuman.push(`Enum values changed for "${event.field}" on ${event.method} ${event.path} (${event.section}): +[${event.added.join(', ')}] -[${event.removed.join(', ')}]. CLAUDE.md says update help text only, but there is no safe anchor to regenerate that text from.`)
        break
      }
      case 'global-enum-changed': {
        needsHuman.push(`Enum values changed for "${event.field}" across schemas: +[${event.added.join(', ')}] -[${event.removed.join(', ')}].`)
        break
      }
      case 'endpoint-added':
        needsHuman.push(`New endpoint ${event.method} ${event.path}. Needs a human to decide whether it warrants a new CLI command.`)
        break
      case 'endpoint-removed':
        needsHuman.push(`Endpoint removed: ${event.method} ${event.path}. Needs a human to decide whether to remove the corresponding CLI command.`)
        break
      case 'method-added':
        needsHuman.push(`New method ${event.method} on existing path ${event.path}. Needs a human to decide the CLI surface.`)
        break
      case 'method-removed':
        needsHuman.push(`Method removed: ${event.method} ${event.path}.`)
        break
      case 'schema-added':
        needsHuman.push(`New schema "${event.name}" in the spec.`)
        break
      case 'schema-removed':
        needsHuman.push(`Schema removed: "${event.name}".`)
        break
      case 'type-changed':
        needsHuman.push(`Type changed for "${event.field}" on ${event.method} ${event.path} (${event.section}): ${event.detail}`)
        break
      case 'required-changed':
        needsHuman.push(`Requiredness changed for "${event.field}" on ${event.method} ${event.path} (${event.section}): ${event.detail}`)
        break
    }
  }

  return { applicable, needsHuman }
}
