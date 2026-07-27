import type { ApplicableChange } from './classify'
import { snakeToCamel, snakeToKebab, snakeToTitle } from './case'

export interface SourceFiles {
  resources: string
  index: string
  schema: string
}

function leadingWhitespace(line: string): string {
  return /^(\s*)/.exec(line)![1]
}

/**
 * Bounds a search to one function/block: from `startIdx` up to (but not
 * including) the next top-level `export ` declaration, or EOF. Every anchor
 * search below is scoped this way so a match can never leak into an
 * unrelated function later in the file.
 */
function sliceToNextExport(src: string, startIdx: number): { text: string, end: number } {
  const rest = src.slice(startIdx)
  const nextExport = rest.slice(1).search(/^export /m)
  const end = nextExport === -1 ? src.length : startIdx + 1 + nextExport
  return { text: src.slice(startIdx, end), end }
}

function insertLineBefore(src: string, region: { start: number, end: number }, anchorRe: RegExp, newLine: (indent: string) => string, opts?: { indentFromPreviousLine?: boolean }): string {
  const region_text = src.slice(region.start, region.end)
  const lines = region_text.split('\n')
  const idx = lines.findIndex(l => anchorRe.test(l))
  if (idx === -1)
    throw new Error(`apply: anchor ${anchorRe} not found in region`)
  // A closing-bracket anchor sits 2 spaces shallower than the array elements, so an
  // inserted sibling must take its indent from the element above, not the anchor.
  const indent = opts?.indentFromPreviousLine && idx > 0 && lines[idx - 1].trim() !== ''
    ? leadingWhitespace(lines[idx - 1])
    : leadingWhitespace(lines[idx])
  lines.splice(idx, 0, newLine(indent))
  const patchedRegion = lines.join('\n')
  return src.slice(0, region.start) + patchedRegion + src.slice(region.end)
}

/** Adds `<field>?: <tsType>` to the function's options type, right before its `json` prop. */
export function applyResourcesField(src: string, change: ApplicableChange): string {
  const fieldCamel = snakeToCamel(change.field)
  const declRe = new RegExp(`export async function ${change.fn}\\(`)
  const declMatch = declRe.exec(src)
  if (!declMatch)
    throw new Error(`apply: function "${change.fn}" not found in resources.ts`)
  const declIdx = declMatch.index

  const { text: fnBody, end: fnEnd } = sliceToNextExport(src, declIdx)

  // Idempotent: if this run (or a previous one) already added the field, don't add it twice.
  if (new RegExp(`\\b${fieldCamel}\\??:\\s*(string|number)\\b`).test(fnBody))
    return src

  const tsType = change.type?.includes('number') || change.type?.includes('integer') ? 'number' : 'string'
  const jsonPropRe = /^(\s*)json\??:\s*boolean\b/

  const lines = fnBody.split('\n')
  const jsonIdx = lines.findIndex(l => jsonPropRe.test(l))
  if (jsonIdx === -1)
    throw new Error(`apply: could not find a "json?: boolean" options property in ${change.fn} to anchor the new field before`)
  const indent = leadingWhitespace(lines[jsonIdx])
  lines.splice(jsonIdx, 0, `${indent}${fieldCamel}?: ${tsType}`)

  // Now find the request line (apiPost</apiPut<) and insert the pass-through
  // statement right before it, so the new field only ships when the caller
  // actually passes the flag (matches the update-function convention, and is
  // also safe for create functions since it's an additive optional key).
  const requestLineRe = /^(\s*)(?:const \w+ = )?await api(?:Post|Put)</
  const requestIdx = lines.findIndex(l => requestLineRe.test(l))
  if (requestIdx === -1)
    throw new Error(`apply: could not find an "await apiPost</apiPut<" call in ${change.fn} to anchor the field pass-through before`)
  const requestIndent = leadingWhitespace(lines[requestIdx])
  lines.splice(requestIdx, 0, `${requestIndent}if (options.${fieldCamel} !== undefined) body.${change.field} = options.${fieldCamel}`)

  const patchedFn = lines.join('\n')
  return src.slice(0, declIdx) + patchedFn + src.slice(fnEnd)
}

/** Adds `--<field-kebab> <value>` right before the command's `--json` option. */
export function applyIndexOption(src: string, change: ApplicableChange): string {
  const fieldKebab = snakeToKebab(change.field)
  const title = snakeToTitle(change.field)

  const actionRe = new RegExp(`\\.action\\([^)]*=>\\s*${change.fn}\\(`)
  const actionMatch = actionRe.exec(src)
  if (!actionMatch)
    throw new Error(`apply: no ".action(... => ${change.fn}(...))" wiring found in index.ts`)

  // Bound the search for the command block backwards to the previous blank
  // line or `.command(` call, so we never touch an unrelated command that
  // happens to also end in `.option('--json', ...)`.
  const before = src.slice(0, actionMatch.index)
  const blockStart = before.lastIndexOf('\n\n') + 1
  const optionRe = /^(\s*)\.option\('--json',/m

  if (new RegExp(`--${fieldKebab}\\b`).test(before.slice(blockStart)))
    return src // idempotent: already added

  return insertLineBefore(
    src,
    { start: blockStart, end: actionMatch.index },
    optionRe,
    indent => `${indent}.option('--${fieldKebab} <value>', '${title} (added by api-sync)')`,
  )
}

/** Adds a FieldDef entry to schema.ts's declarative mirror for `blindpay schema get <resource>`. */
export function applySchemaField(src: string, change: ApplicableChange): string {
  const resourceRe = new RegExp(`resource: '${change.resource}',`)
  const resourceMatch = resourceRe.exec(src)
  if (!resourceMatch)
    throw new Error(`apply: resource "${change.resource}" not found in schema.ts`)

  const { text: resourceBlock, end: resourceEnd } = sliceToNextResourceEntry(src, resourceMatch.index)

  const opRe = new RegExp(`${change.op}: \\{`)
  const opMatch = opRe.exec(resourceBlock)
  if (!opMatch) {
    // The resource has no `create`/`update` block yet in schema.ts (e.g. it's
    // list-only today). Adding one from scratch needs a human: schema.ts's
    // FieldDef list for a brand-new operation isn't a single-line insert.
    throw new Error(`apply: resource "${change.resource}" has no "${change.op}:" block in schema.ts to extend`)
  }

  if (new RegExp(`name: '${change.field}'`).test(resourceBlock))
    return src // idempotent

  const tsType = change.type?.includes('number') || change.type?.includes('integer') ? 'number' : 'string'
  const requiredLiteral = change.required ? 'true' : 'false'
  const title = snakeToTitle(change.field)
  const newFieldLine = (indent: string) => `${indent}{ name: '${change.field}', type: '${tsType}', required: ${requiredLiteral}, description: '${title} (added by api-sync)' },`

  const patchedBlock = insertLineBefore(
    resourceBlock,
    { start: opMatch.index, end: resourceBlock.length },
    /^(\s*)\],\s*$/,
    newFieldLine,
    { indentFromPreviousLine: true },
  )

  return src.slice(0, resourceMatch.index) + patchedBlock + src.slice(resourceEnd)
}

function sliceToNextResourceEntry(src: string, startIdx: number): { text: string, end: number } {
  const rest = src.slice(startIdx)
  const nextResource = rest.slice(1).search(/resource: '/)
  const end = nextResource === -1 ? src.length : startIdx + 1 + nextResource
  return { text: src.slice(startIdx, end), end }
}
