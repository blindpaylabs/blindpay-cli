#!/usr/bin/env bun
/**
 * Deterministic api-sync entry point. Reads the changelog pushed by
 * blindpay-v2's sdk-sync workflow, classifies every change as either
 * mechanically applicable or needs-human, applies the applicable ones to
 * src/commands/resources.ts, src/index.ts, src/commands/schema.ts, and
 * bumps package.json's version. Writes a machine-readable summary to
 * stdout as the last line (prefixed `SUMMARY_JSON:`) for the workflow to
 * pick up.
 *
 * Usage: bun scripts/api-sync/generate.ts --changelog <path> --repo-root <path>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { applyIndexOption, applyResourcesField, applySchemaField } from './apply'
import { classify } from './classify'
import { parseChangelog } from './parse-changelog'
import { bumpVersion, deriveVersionBump } from './version-bump'

function main() {
  const { values } = parseArgs({
    options: {
      changelog: { type: 'string' },
      'repo-root': { type: 'string', default: '.' },
    },
  })

  if (!values.changelog)
    throw new Error('usage: generate.ts --changelog <path> [--repo-root <path>]')

  const root = values['repo-root']!
  const changelogMd = readFileSync(values.changelog, 'utf8')
  const events = parseChangelog(changelogMd)
  const { applicable, needsHuman } = classify(events)

  const resourcesPath = join(root, 'src/commands/resources.ts')
  const indexPath = join(root, 'src/index.ts')
  const schemaPath = join(root, 'src/commands/schema.ts')
  const pkgPath = join(root, 'package.json')

  let resourcesSrc = readFileSync(resourcesPath, 'utf8')
  let indexSrc = readFileSync(indexPath, 'utf8')
  let schemaSrc = readFileSync(schemaPath, 'utf8')

  const applied: string[] = []
  for (const change of applicable) {
    resourcesSrc = applyResourcesField(resourcesSrc, change)
    indexSrc = applyIndexOption(indexSrc, change)
    // Schema.ts field mirroring is best-effort documentation: some known
    // resources don't have a matching create/update fields block to extend
    // yet (e.g. update on a resource that's create-only in schema.ts today).
    // That's a schema.ts staleness issue pre-existing this generator, not a
    // reason to fail the whole run — the CLI still works without it.
    try {
      schemaSrc = applySchemaField(schemaSrc, change)
    }
    catch (e) {
      needsHuman.push(`schema.ts mirror not updated for "${change.field}" on ${change.resource}.${change.op}: ${(e as Error).message}`)
    }
    applied.push(`${change.resource}.${change.op}: +${change.field}`)
  }

  const { type: bumpType, reasons: bumpReasons } = deriveVersionBump(events)

  if (applied.length > 0) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    const nextVersion = bumpVersion(pkg.version, bumpType)
    pkg.version = nextVersion
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    writeFileSync(resourcesPath, resourcesSrc)
    writeFileSync(indexPath, indexSrc)
    writeFileSync(schemaPath, schemaSrc)
  }

  const summary = {
    appliedCount: applied.length,
    applied,
    needsHumanCount: needsHuman.length,
    needsHuman,
    bumpType,
    bumpReasons,
    canAutoMerge: needsHuman.length === 0 && applied.length > 0,
    hasChanges: applied.length > 0,
  }

  console.log(`SUMMARY_JSON:${JSON.stringify(summary)}`)
}

main()
