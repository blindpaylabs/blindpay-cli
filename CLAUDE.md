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
    constants.ts                # CLI_VERSION, DEFAULT_API_URL.
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

### Linting

`oxlint` enforces formatting and lint. Run `bun run lint:fix` after
edits and ensure `bun run typecheck` is clean before opening a PR.

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
3. Bump CLI version in `src/utils/constants.ts` (`CLI_VERSION`) — patch
   for additive changes, minor if you removed anything.
4. Run `bun run typecheck` and `bun run lint:fix`. Fix any errors.
5. Do NOT touch `.github/workflows/`.
6. Do NOT create commits — leave changes in the working tree.

If a change in the changelog doesn't map to any CLI surface (e.g. a
schema-only change with no field added), skip it silently.
