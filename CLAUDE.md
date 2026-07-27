# BlindPay CLI - Agent Reference

## Commands

```
bun run dev               # Run CLI directly from source
bun run build             # Bundle to dist/index.js
bun run typecheck         # tsc --noEmit
bun run lint              # oxlint
bun run lint:fix          # oxlint --fix
bun run test              # bun test
```

## How updates work

This CLI is auto-synced with the BlindPay API. When SDK-eligible
(`x-sdk: true`) routes change upstream, the workflow at
`.github/workflows/api-sync.yml` fires:

1. The blindpay-v2 `sdk-sync.yml` workflow generates a markdown changelog
   from the OpenAPI spec diff and pushes it to this repo's
   `api-sync-data` branch at `.api-sync/changelog.md`. It then fires a
   `repository_dispatch` `api-sync` event.
2. `api-sync.yml` consumes the event and runs a pure script,
   `scripts/api-sync/generate.ts` — no LLM, no `claude-code-action`. See
   "The deterministic api-sync pipeline" below for what it does and does
   not touch.
3. If everything the changelog contains was mechanically applicable, the
   PR auto-merges once CI passes. If any change needed a human, the PR
   (or, if there was nothing applicable at all, a plain issue) stays open
   for manual review and is never auto-merged.

Note: not every API change needs a CLI change. The CLI is hand-curated
UX — only commands a human would actually want to run from a terminal.

## The deterministic api-sync pipeline

`scripts/api-sync/generate.ts` is the only thing that runs in CI for a
sync. It is a straight pipeline, in `scripts/api-sync/`:

- `parse-changelog.ts` — parses the exact markdown format blindpay-v2's
  `scripts/spec-diff.ts` emits into structured events (field added/removed,
  enum changed, endpoint/method/schema added/removed). This is a format
  parser, not a heuristic: an unrecognized bullet makes it throw rather
  than silently drop content.
- `known-resources.ts` — the generator's entire "what can I touch" map:
  each entry pairs a `schema.ts` resource name with the OpenAPI path(s)
  and the exact `src/commands/resources.ts` function name that build its
  create/update request body. A path NOT listed here is unmappable by
  construction. **Extending this map to a genuinely new resource is a
  hand-written change to make deliberately** — the generator will never
  infer it from a changelog.
- `classify.ts` — splits parsed events into `applicable` (CAN be expressed
  by the generator) and `needsHuman` (cannot). Today the CAN-express
  surface is deliberately narrow: **an additive, optional field on the
  REQUEST body of a create/update path listed in `known-resources.ts`.**
  Everything else — removed fields, enum value changes, response-only
  field changes, new/removed endpoints, methods, or schemas — is routed
  to `needsHuman` with a plain-English reason, even where a human
  historically handled it mechanically too (see the comment at the top of
  `classify.ts` for why each of those categories isn't safe to script
  today).
- `apply.ts` — applies one field addition: adds `<field>?: <type>` to the
  matching function's options type in `resources.ts` (anchored on its
  `json?: boolean` prop), a pass-through statement before its
  `apiPost</apiPut<` call, a new `--<field-kebab> <value>` option in
  `index.ts` (anchored on that command's `--json` option), and a mirrored
  `FieldDef` in `schema.ts`. Every insertion is anchor-based and
  idempotent — re-running it against already-patched source is a no-op,
  which is what makes the pipeline safe to re-run and byte-identical
  across runs of the same input.
- `version-bump.ts` — minor if the changelog added/removed any
  endpoint, method, or enum value; patch otherwise. Scripted from the
  parsed events, never guessed.
- `generate.ts` — orchestrates all of the above, writes the patched
  files plus the bumped `package.json` version, and prints a
  `SUMMARY_JSON:` line the workflow reads to decide whether to run CI,
  open a PR, and whether that PR is eligible for auto-merge.

If the changelog contains ONLY changes the generator can't express, no
files change and the workflow opens a plain GitHub issue listing them
instead of a PR — there's no code diff to review, but staying silent
would bury a real API change.

Tests for the pipeline itself live in `scripts/api-sync/__tests__/` and
run via the same `bun test` CI uses for the CLI's own tests.

## Project structure

```
src/
  index.ts                      # commander program: top-level commands and
                                # subcommand wiring. One Command per resource.
  commands/
    resources.ts                # All resource action implementations.
                                # Each exported function = one command action.
    schema.ts                   # listSchemas, getSchema commands.
  utils/
    api-client.ts               # apiGet/apiPost/apiPut/apiDelete wrappers
                                # over fetch, plus resolveContext().
    config.ts                   # ~/.config/blindpay/config.json read/write.
    output.ts                   # formatOutput(data, json, columns?) for
                                # table vs JSON rendering.
    constants.ts                # CLI_VERSION (derived from package.json),
                                # DEFAULT_API_URL.
  __tests__/                    # bun test suites
    api-client.test.ts          # resolveContext + env-var handling
    config.test.ts              # ~/.config read/write
    output.test.ts              # formatTable/formatJson/truncate
    resources.test.ts           # one happy-path test per action in
                                # commands/resources.ts. fetch is mocked
                                # via globalThis.fetch + URL/method/body
                                # assertions.
```

## Conventions

### Adding a new command

1. Add an exported async function to `src/commands/resources.ts` (or a
   new module if it's a brand new resource). Naming pattern:
   `<verb><Resource>`, e.g. `listCustomers`, `getPayout`, `createBankAccount`,
   `deleteWebhookEndpoint`.
2. Wire it in `src/index.ts` under the appropriate `program.command(...)`
   group. Keep groups together with a banner comment
   (`// ── Resource ─────────────────────────────────────`).
3. Add `--json` to any read-only command. Use `printResult(data, json,
   columns)` to render — pass meaningful columns for the default
   non-JSON output.
4. Path params (e.g. `<id>`, `<customer-id>`) are positional or
   `--customer-id <id>` flags depending on whether they belong to the
   primary resource being acted on. Look at how existing commands handle
   parent IDs (bank_accounts uses `--customer-id`).
5. Wrap all API calls with `try/catch` and route errors through
   `handleApiError(err, json)`.
6. Use `parseAmount(...)` (already in resources.ts) for any amount field
   to enforce non-negative integers (cents).
7. Add a test for the new action in `src/__tests__/resources.test.ts`,
   matching the existing pattern: set `mockResponse.body`, call the
   action, then assert `lastCall().method`, `lastCall().url`, and
   `lastCall().body`. One happy-path test per action is the minimum;
   include an extra test for any non-trivial body shaping
   (e.g. cents-scaling, optional-field omission, network-path branching).
   **Place the test inside the existing `describe(...)` block that
   matches the command's top-level CLI group.** A `customers rfi_submit`
   command's test goes inside `describe('Customers', ...)` alongside
   `lists customers` / `fetches a customer by id`, not in a new
   `describe('RFI', ...)`. Only create a new describe block when you are
   introducing a brand-new top-level group (e.g. the first `transfers`
   command).

### Naming

| API path                                              | Command                          |
| ----------------------------------------------------- | -------------------------------- |
| `GET /v1/instances/{id}/customers`                    | `blindpay customers list`        |
| `POST /v1/instances/{id}/customers/{cid}/bank-accounts` | `blindpay bank_accounts create`  |
| `GET /v1/available/...`                               | `blindpay available rails`       |

Group names use `snake_case` (matching the API resource name with
hyphens replaced by underscores), command names use kebab/lowercase.

### Output

Default output is a small terminal table built by `formatOutput`. Pass
explicit `columns` so the default view shows the most useful 4–6 fields,
not every field. `--json` always prints the full object as `JSON.stringify(_, null, 2)`.

### Errors

`handleApiError` already formats API validation errors, status codes,
and unknown errors. Don't roll your own.

`exitWithError(message, exitCode, json)` is for client-side validation
failures (bad CLI flags etc).

### Prompts

We do not use interactive prompts for CLI commands today — every input
is a flag. Don't introduce `clack.prompt` mid-command unless the user
explicitly opts in via `--interactive` or similar.

### Dynamic request bodies

When an endpoint accepts an arbitrary object body (e.g. the OpenAPI
schema is `z.record(z.string(), z.any())` or `Record<string, unknown>`),
do **not** ship a command with an empty `{}` body and a TODO. Accept
the body as a single `--body <json>` flag and parse it. Pattern:

```ts
export async function submitCustomerRfi(
  customerId: string,
  options: { body: string; json: boolean },
) {
  let body: Record<string, unknown>
  try { body = JSON.parse(options.body) }
  catch (e) {
    exitWithError(`Invalid --body JSON: ${(e as Error).message}`, 1, options.json)
  }
  try {
    const ctx = resolveContext()
    const res = await apiPost<{ success: boolean }>(
      ctx,
      `${instancePath(ctx)}/customers/${customerId}/rfi`,
      body,
    )
    clack.log.success('RFI response submitted')
    if (options.json) console.log(formatOutput(res, true))
  }
  catch (e) { handleApiError(e, options.json) }
}
```

The user constructs the body shape on the command line:
`blindpay customers rfi_submit re_xyz --body '{"address":"..."}'`.

Use `--body` as the standard flag name for all dynamic-body endpoints.
Don't pick a semantically-flavored name like `--response` or
`--payload` — `--body` is consistent across commands and matches what
the value actually is (the HTTP request body, verbatim).

### No TODO markers in shipped commands

Don't leave `// TODO(api-sync):` markers in commands you ship. If you
can't figure out a sensible flag shape, fall back to the JSON-string
pattern above. TODOs are only acceptable for low-signal cleanups
(e.g. column tuning) — never for command behavior that would otherwise
be broken or unusable.

### Linting

`oxlint` enforces formatting and lint. Run `bun run lint:fix` after
edits and ensure `bun run typecheck` is clean before opening a PR.

### Testing

Tests live in `src/__tests__/` and run via `bun test`. The action
functions in `commands/resources.ts` are tested in `resources.test.ts`
by stubbing `globalThis.fetch` and asserting the request the action
constructs. The helpers `setupTestEnv` / `teardownTestEnv` at the top
of that file install the stubs in `beforeEach`/`afterEach`; reuse them
when adding tests. Don't introduce a real network or filesystem
dependency.

Required state per test: set `mockResponse = { status, body }` for the
fetch return value, call the action, then read `lastCall()` for the
recorded `url`/`method`/`body`. Error-path tests assert that the action
throws `__test_exit__<code>` (the stubbed `process.exit` re-throws so
the test runner sees the exit code).

## Reviewing a needs-human api-sync PR or issue

`scripts/api-sync/generate.ts` (see "The deterministic api-sync
pipeline" above) already applied everything it safely could. What's left
in the PR/issue body's "Needs a human" section is exactly what it
couldn't express. When picking one up by hand:

- **New endpoint** → Add a CLI command only if a terminal user is
  plausibly going to run it. Usually yes for CRUD-style endpoints, no
  for internal/read-only diagnostics. When in doubt, add it.
- **New field on an input, on a path not in `known-resources.ts`** →
  Add a corresponding `--<field>` flag to the command's option list and
  pass it through. Consider also adding the path to
  `scripts/api-sync/known-resources.ts` so future additions on it are
  handled automatically.
- **New field on an output** → Update the default `columns` array if
  the field is interesting; don't add columns for low-signal fields.
- **Removed endpoint/field** → Remove the corresponding command/flag.
- **Enum value added** → Update help text only (CLI doesn't validate
  enum values client-side).
- Add or update tests in `src/__tests__/resources.test.ts` for every
  action you add, modify, or remove by hand. See "Testing" above.
- Bump the `version` field in `package.json` if you're adding to a PR
  the generator already bumped — patch for additive changes, minor if
  you removed anything.
- Run `bun run typecheck`, `bun run lint:fix`, and `bun run test`.

If a change in the changelog doesn't map to any CLI surface at all
(e.g. a schema-only change with no field added), the generator already
skipped it silently — that's expected, not a bug to report.
