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
2. `api-sync.yml` consumes the event, runs Claude with the changelog as
   input, and asks Claude to read this CLAUDE.md plus the codebase to
   decide what (if any) CLI changes are needed.
3. A PR is opened/updated on the `api-sync` branch for human review.

Note: not every API change needs a CLI change. The CLI is hand-curated
UX — only commands a human would actually want to run from a terminal.

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
   `<verb><Resource>` — `listReceivers`, `getPayout`, `createBankAccount`,
   `deleteWebhookEndpoint`.
2. Wire it in `src/index.ts` under the appropriate `program.command(...)`
   group. Keep groups together with a banner comment
   (`// ── Resource ─────────────────────────────────────`).
3. Add `--json` to any read-only command. Use `printResult(data, json,
   columns)` to render — pass meaningful columns for the default
   non-JSON output.
4. Path params (e.g. `<id>`, `<receiver-id>`) are positional or
   `--receiver-id <id>` flags depending on whether they belong to the
   primary resource being acted on. Look at how existing commands handle
   parent IDs (bank_accounts uses `--receiver-id`).
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
   matches the command's top-level CLI group.** A `receivers submit_rfi`
   command's test goes inside `describe('Receivers', ...)` alongside
   `lists receivers` / `fetches a receiver by id` — not in a new
   `describe('RFI', ...)`. Only create a new describe block when you are
   introducing a brand-new top-level group (e.g. the first `transfers`
   command).

### Naming

| API path                                              | Command                          |
| ----------------------------------------------------- | -------------------------------- |
| `GET /v1/instances/{id}/receivers`                    | `blindpay receivers list`        |
| `POST /v1/instances/{id}/receivers/{rid}/bank-accounts` | `blindpay bank_accounts create`  |
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
the body as a single JSON-string flag and parse it. Pattern:

```ts
export async function submitReceiverRfi(
  receiverId: string,
  options: { response: string; json: boolean },
) {
  let body: Record<string, unknown>
  try { body = JSON.parse(options.response) }
  catch (e) {
    exitWithError(`Invalid --response JSON: ${(e as Error).message}`, 1, options.json)
  }
  try {
    const ctx = resolveContext()
    const res = await apiPost<{ success: boolean }>(
      ctx,
      `${instancePath(ctx)}/receivers/${receiverId}/rfi`,
      body,
    )
    clack.log.success('RFI response submitted')
    if (options.json) console.log(formatOutput(res, true))
  }
  catch (e) { handleApiError(e, options.json) }
}
```

The user constructs the body shape on the command line:
`blindpay receivers submit_rfi re_xyz --response '{"address":"..."}'`.

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

## Sync workflow conventions

When responding to an api-sync event:

1. Read `.api-sync/changelog.md`. It lists every API change since the
   last sync.
2. For each change, decide:
   - **New endpoint** → Add a CLI command only if a terminal user is
     plausibly going to run it. Usually yes for CRUD-style endpoints,
     no for internal/read-only diagnostics. When in doubt, add it.
   - **New field on an input** → Add a corresponding `--<field>` flag
     to the command's option list and pass it through.
   - **New field on an output** → Update the default `columns` array if
     the field is interesting; don't add columns for low-signal fields.
   - **Removed endpoint/field** → Remove the corresponding command/flag.
   - **Enum value added** → Update help text only (CLI doesn't validate
     enum values client-side).
3. Add or update tests in `src/__tests__/resources.test.ts` for every
   action you added or modified. New action → new happy-path test
   (URL + method + body). Modified body shape → update the matching
   test's expected body. Removed action → remove its test. See the
   "Testing" section above for the helper pattern.
4. Bump the `version` field in `package.json` — patch for additive
   changes, minor if you removed anything. `CLI_VERSION` is derived
   from `package.json` at build time; don't edit `constants.ts`.
5. Run `bun run typecheck`, `bun run lint:fix`, and `bun run test`. Fix any errors.
6. Do NOT touch `.github/workflows/`.
7. Do NOT create commits — leave changes in the working tree.

If a change in the changelog doesn't map to any CLI surface (e.g. a
schema-only change with no field added), skip it silently.
