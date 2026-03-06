# CLI Manual Test Plan

Exhaustive checklist for every CLI command and option. Use after changes or before release.

## Prerequisites

- [ ] Build: `bun run build` (or `npm run build`) succeeds
- [ ] Mock server is running: `blindpay mock` (default port 4242)
- [ ] Optional: For webhook tests, start test server: `bun run test-server.ts` (port 3333), then `blindpay mock --forward-to http://localhost:3333/webhooks`

---c

## Help

- [ ] `blindpay --help` — shows main commands (mock, trigger, advance, status, receivers, bank_accounts, etc.)
- [ ] `blindpay mock --help` — shows options: `-D, --detach`, `-p, --port`, `-f, --forward-to`, `-m, --manual`, `--delay`, subcommand `stop`
- [ ] `blindpay receivers --help` — shows list, get, create, delete
- [ ] `blindpay bank_accounts --help` — shows list, get, create, delete
- [ ] `blindpay trigger --help` — shows `<event>`, `--payout-id`, `--payin-id`
- [ ] `blindpay advance --help` — shows `<resource> <id>`, `--to` (processing, completed, failed)

---

## Mock server

- [ ] `blindpay mock` — starts with intro "Blindpay Mock Server", seed data note, webhook signing secret, "Running on http://localhost:4242"; request log lines for each HTTP call; Ctrl+C stops and prints "Server stopped."
- [ ] `blindpay mock --port 4243` — listens on 4243; `blindpay status --port 4243` works
- [ ] `blindpay mock --forward-to http://localhost:3333/hook` — startup log includes "Forwarding webhooks to: http://localhost:3333/hook"
- [ ] `blindpay mock --manual` — log says "Manual mode enabled" and "Use blindpay advance payout <id>"
- [ ] `blindpay mock --delay 5000` — lifecycle steps delay 5s (create payout, watch logs)
- [ ] `blindpay mock -D` or `blindpay mock --detach` — parent exits after "Mock server running in background"; `blindpay status` works; `blindpay mock stop` stops it and prints "Server stopped."
- [ ] `blindpay mock stop` with no server — prints "No mock server is running."

---

## Status

- [ ] `blindpay status` — table with Instances, Receivers, Bank Accounts, Blockchain Wallets, Quotes, Payouts, Payin Quotes, Payins, API Keys, Webhook Endpoints, Partner Fees, Virtual Accounts, Offramp Wallets (numbers)
- [ ] `blindpay status --port 4243` — same, when mock is on 4243

---

## Receivers

- [ ] `blindpay receivers list` — table: id, type, name, email, country, kyc_status (seed: re_mock_indiv01, re_mock_bizz01)
- [ ] `blindpay receivers list --json` — raw JSON array of receivers
- [ ] `blindpay receivers get re_mock_indiv01` — full receiver object (table or JSON-like)
- [ ] `blindpay receivers get re_mock_indiv01 --json` — raw JSON
- [ ] `blindpay receivers get re_nonexistent` — error "Receiver re_nonexistent not found", exit 1
- [ ] `blindpay receivers create --email test@example.com` — "Created receiver re*xxx", id matches re*
- [ ] `blindpay receivers create --email a@b.com --name "John Doe"` — created receiver has first_name "John", last_name "Doe" (check with get)
- [ ] `blindpay receivers create --email a@b.com --first-name Jane --last-name Smith` — created has first_name Jane, last_name Smith
- [ ] `blindpay receivers create --email corp@b.com --type business --legal-name "Acme Inc"` — type business, legal_name Acme Inc
- [ ] `blindpay receivers create --email a@b.com --country BR` — country BR
- [ ] `blindpay receivers create --email a@b.com --tax-id 123456` — tax_id in payload
- [ ] `blindpay receivers create --email a@b.com --external-id ext123` — external_id in payload
- [ ] `blindpay receivers create --email a@b.com --kyc-status verifying` — kyc_status verifying (get shows it)
- [ ] `blindpay receivers create --email a@b.com --json` — prints JSON of created receiver
- [ ] `blindpay receivers delete re_<id>` (use id from create) — "Deleted receiver re_xxx"
- [ ] `blindpay receivers delete re_nonexistent` — error "Receiver re_nonexistent not found", exit 1

---

## Bank accounts

- [ ] `blindpay bank_accounts list --receiver-id re_mock_indiv01` — table of bank accounts for that receiver (e.g. ba_mock_ach001, ba_mock_wire01, ba_mock_swift1)
- [ ] `blindpay bank_accounts list --receiver-id re_mock_indiv01 --json` — raw JSON
- [ ] `blindpay bank_accounts list` (no --receiver-id) — error "--receiver-id is required"
- [ ] `blindpay bank_accounts get ba_mock_ach001` — full bank account object
- [ ] `blindpay bank_accounts get ba_mock_ach001 --json` — raw JSON
- [ ] `blindpay bank_accounts get ba_nonexistent` — error "Bank account ba_nonexistent not found"
- [ ] `blindpay bank_accounts create --receiver-id re_mock_indiv01 --type ach --beneficiary-name "John" --routing-number 021000021 --account-number 1234567890 --account-type checking --account-class individual` — "Created bank account ba_xxx (ach)"
- [ ] `blindpay bank_accounts create --receiver-id re_mock_bizz01 --type pix --pix-key 12345678000100 --country BR` — created (pix)
- [ ] `blindpay bank_accounts create --receiver-id re_mock_indiv01 --name "My ACH"` — name in created resource
- [ ] `blindpay bank_accounts create --receiver-id re_mock_indiv01 --json` — prints JSON
- [ ] `blindpay bank_accounts create` without --receiver-id — error "--receiver-id is required"
- [ ] `blindpay bank_accounts delete ba_<id>` (use id from create) — "Deleted bank account ba_xxx"
- [ ] `blindpay bank_accounts delete ba_nonexistent` — error "Bank account ba_nonexistent not found"

---

## Blockchain wallets

- [ ] `blindpay blockchain_wallets list --receiver-id re_mock_indiv01` — table (e.g. bw_mock_evm001, bw_mock_sol001)
- [ ] `blindpay blockchain_wallets list --receiver-id re_mock_indiv01 --json` — raw JSON
- [ ] `blindpay blockchain_wallets list` without --receiver-id — error "--receiver-id is required"
- [ ] `blindpay blockchain_wallets get bw_mock_evm001` — full wallet object
- [ ] `blindpay blockchain_wallets get bw_mock_evm001 --json` — raw JSON
- [ ] `blindpay blockchain_wallets create --receiver-id re_mock_indiv01 --address 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18 --network base` — "Created blockchain wallet bw_xxx (base)"
- [ ] `blindpay blockchain_wallets create --receiver-id re_mock_indiv01 --address 0xabc... --network base --external-id ext1` — external_id in payload
- [ ] `blindpay blockchain_wallets create --receiver-id re_mock_indiv01 --address 0xabc... --json` — prints JSON
- [ ] `blindpay blockchain_wallets delete bw_<id>` — "Deleted blockchain wallet bw_xxx"
- [ ] `blindpay blockchain_wallets delete bw_nonexistent` — error "Blockchain wallet bw_nonexistent not found"

---

## Quotes

- [ ] `blindpay quotes create --bank-account-id ba_mock_ach001` — "Created quote qu_xxx (X USDC -> Y USD)" (or similar)
- [ ] `blindpay quotes create --bank-account-id ba_mock_ach001 --amount 5000 --network base --token USDC` — quote with amount 5000
- [ ] `blindpay quotes create --bank-account-id ba_mock_ach001 --json` — prints JSON
- [ ] `blindpay quotes create` without --bank-account-id — error "--bank-account-id is required"
- [ ] `blindpay quotes create --bank-account-id ba_nonexistent` — error (bank account not found)
- [ ] `blindpay quotes fx` — "FX Rate: 1 USDC = X BRL" (default from USDC to BRL)
- [ ] `blindpay quotes fx --from USDC --to BRL --amount 1000` — rate line

---

## Payouts

- [ ] `blindpay quotes create --bank-account-id ba_mock_ach001` — get quote id (qu_xxx)
- [ ] `blindpay payouts create --quote-id qu_<id>` — "Created payout pa_xxx (processing)"
- [ ] `blindpay payouts create --quote-id qu_<id> --sender-wallet-address 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18` — created with custom sender
- [ ] `blindpay payouts create --quote-id qu_<id> --json` — prints JSON
- [ ] `blindpay payouts create` without --quote-id — error (required option)
- [ ] `blindpay payouts create --quote-id qu_nonexistent` — error "Quote qu_nonexistent not found"
- [ ] `blindpay payouts list` — table: id, status, amount, network, created_at (or "No data found" if empty)
- [ ] `blindpay payouts list --status processing` — only processing payouts
- [ ] `blindpay payouts list --json` — raw JSON
- [ ] `blindpay payouts get pa_<id>` — full payout object
- [ ] `blindpay payouts get pa_nonexistent` — error "Payout pa_nonexistent not found"

---

## Payin quotes

- [ ] `blindpay payin_quotes create --blockchain-wallet-id bw_mock_evm001 --payment-method pix` — "Created payin quote pq_xxx (...)"
- [ ] `blindpay payin_quotes create --blockchain-wallet-id bw_mock_evm001 --payment-method ach --amount 5000 --currency USD` — created with amount/currency
- [ ] `blindpay payin_quotes create --blockchain-wallet-id bw_mock_evm001 --payment-method pix --json` — prints JSON
- [ ] `blindpay payin_quotes create` without required options — error (required option)
- [ ] `blindpay payin_quotes create --blockchain-wallet-id bw_nonexistent --payment-method pix` — error (blockchain wallet not found)

---

## Payins

- [ ] `blindpaycle` — get payin quote id (pq_xxx)
- [ ] `blindpay payins create --payin-quote-id pq_<id>` — "Created payin pi_xxx (processing)"
- [ ] `blindpay payins create --payin-quote-id pq_<id> --external-id my-ref` — created with external_id
- [ ] `blindpay payins create --payin-quote-id pq_<id> --json` — prints JSON
- [ ] `blindpay payins create` without --payin-quote-id — error (required option)
- [ ] `blindpay payins create --payin-quote-id pq_nonexistent` — error (payin quote not found)
- [ ] `blindpay payins list` — table or "No data found"
- [ ] `blindpay payins list --json` — raw JSON
- [ ] `blindpay payins get pi_<id>` — full payin object
- [ ] `blindpay payins get pi_nonexistent` — error "Payin pi_nonexistent not found"

---

## Webhook endpoints

- [ ] `blindpay webhook_endpoints list` — table or empty
- [ ] `blindpay webhook_endpoints list --json` — raw JSON
- [ ] `blindpay webhook_endpoints create --url https://example.com/hook` — "Created webhook endpoint we_xxx -> https://example.com/hook"
- [ ] `blindpay webhook_endpoints create --url https://example.com/hook --description "Test"` — created with description
- [ ] `blindpay webhook_endpoints create --url https://example.com/hook --json` — prints JSON
- [ ] `blindpay webhook_endpoints delete we_<id>` — "Deleted webhook endpoint we_xxx"
- [ ] `blindpay webhook_endpoints delete we_nonexistent` — error "Webhook endpoint we_nonexistent not found"

---

## Partner fees

- [ ] `blindpay partner_fees list` — table (payout_pct, payout_flat, payin_pct, payin_flat) or empty
- [ ] `blindpay partner_fees list --json` — raw JSON
- [ ] `blindpay partner_fees create` — "Created partner fee pf_xxx" (defaults 0)
- [ ] `blindpay partner_fees create --payout-percentage 1.5 --payout-flat 50 --payin-percentage 0.5 --payin-flat 25 --evm-wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18 --stellar-wallet Gxxx` — created with values
- [ ] `blindpay partner_fees create --json` — prints JSON
- [ ] `blindpay partner_fees delete pf_<id>` — "Deleted partner fee pf_xxx"
- [ ] `blindpay partner_fees delete pf_nonexistent` — error "Partner fee pf_nonexistent not found"

---

## API keys

- [ ] `blindpay api_keys list` — table: id, name, key (truncated), permission (e.g. ak_mock_key001, Mock API Key)
- [ ] `blindpay api_keys list --json` — raw JSON
- [ ] `blindpay api_keys create` — "Created API key ak*xxx: bpk_test*..." (default name "CLI API Key")
- [ ] `blindpay api_keys create --name "Production Key"` — created key has name "Production Key"; list shows it
- [ ] `blindpay api_keys create --name "My Key" --json` — prints JSON with id and key
- [ ] `blindpay api_keys delete ak_<id>` — "Deleted API key ak_xxx"
- [ ] `blindpay api_keys delete ak_nonexistent` — error "API key ak_nonexistent not found"

---

## Virtual accounts

- [ ] `blindpay virtual_accounts list --receiver-id re_mock_indiv01` — table or empty
- [ ] `blindpay virtual_accounts list` without --receiver-id — error "--receiver-id is required"
- [ ] `blindpay virtual_accounts create --receiver-id re_mock_indiv01 --blockchain-wallet-id bw_mock_evm001` — "Created virtual account va_xxx" (or similar id)
- [ ] `blindpay virtual_accounts create --receiver-id re_mock_indiv01 --blockchain-wallet-id bw_mock_evm001 --json` — prints JSON
- [ ] `blindpay virtual_accounts create` missing --receiver-id or --blockchain-wallet-id — error for missing option

---

## Offramp wallets

- [ ] `blindpay offramp_wallets list --receiver-id re_mock_indiv01 --bank-account-id ba_mock_ach001` — table or empty
- [ ] `blindpay offramp_wallets list` missing --receiver-id or --bank-account-id — error for missing option
- [ ] `blindpay offramp_wallets list --receiver-id re_mock_indiv01 --bank-account-id ba_mock_ach001 --json` — raw JSON

---

## Available (reference data, no server)

- [ ] `blindpay available rails` — table of rails (type, currency, country, name)
- [ ] `blindpay available rails --json` — raw JSON
- [ ] `blindpay available bank_details --rail ach` — note with required fields (e.g. beneficiary_name, routing_number, account_number, account_type, account_class)
- [ ] `blindpay available bank_details --rail pix` — fields for pix (e.g. pix_key)
- [ ] `blindpay available bank_details --rail wire` — wire fields
- [ ] `blindpay available bank_details --rail international_swift` — SWIFT fields
- [ ] `blindpay available bank_details --rail invalid` — error "Unknown rail ... Available rails: ..."
- [ ] `blindpay available bank_details --rail ach --json` — JSON with rail and fields array

---

## Trigger (requires mock with --forward-to)

- [ ] Mock running **without** --forward-to: `blindpay trigger receiver.new` — error "No forward URLs configured", "Start the mock server first: blindpay mock --forward-to ..."
- [ ] Mock running **with** `--forward-to http://localhost:3333/webhooks`: `blindpay trigger receiver.new` — "Webhook delivered", "Event receiver.new sent to 1 endpoint(s)"
- [ ] `blindpay trigger payout.complete` — delivered
- [ ] `blindpay trigger payout.complete --payout-id pa_<existing_id>` — delivered with that payout id in payload (if payout exists)
- [ ] `blindpay trigger payin.new --payin-id pi_<existing_id>` — delivered with payin id
- [ ] `blindpay trigger invalid.event` — error "Unknown event: invalid.event", list of available events
- [ ] Trigger each event at least once (with --forward-to set): receiver.new, receiver.update, bankAccount.new, payout.new, payout.update, payout.complete, payout.partnerFee, blockchainWallet.new, payin.new, payin.update, payin.complete, payin.partnerFee, tos.accept, limitIncrease.new, limitIncrease.update, virtualAccount.new, virtualAccount.complete

---

## Advance (manual mode)

- [ ] Start mock: `blindpay mock --manual`
- [ ] Create payout: `blindpay quotes create --bank-account-id ba_mock_ach001` then `blindpay payouts create --quote-id qu_<id>`, note payout id
- [ ] `blindpay advance payout pa_<id>` — step message, status/ tracking updates
- [ ] `blindpay advance payout pa_<id> --to completed` — jumps to completed; tracking_transaction, tracking_payment, tracking_complete all show completed
- [ ] `blindpay advance payout pa_<id> --to failed` — status failed; tracking_complete shows **failed** (not completed)
- [ ] `blindpay advance payout pa_<id> --to processing` — resets to processing; all tracking steps show processing
- [ ] Create another payout, `blindpay advance payout pa_<id> --to failed` — status failed
- [ ] Create payin: `blindpay payin_quotes create --blockchain-wallet-id bw_mock_evm001 --payment-method pix` then `blindpay payins create --payin-quote-id pq_<id>`, then `blindpay advance payin pi_<id>` — step message
- [ ] `blindpay advance payin pi_<id> --to completed` — completed
- [ ] `blindpay advance payin pi_<id> --to failed` — failed; tracking_complete shows failed
- [ ] `blindpay advance payin pi_<id> --to processing` — resets to processing
- [ ] `blindpay advance payout pa_nonexistent` — error (payout not found)
- [ ] `blindpay advance payin pi_nonexistent` — error (payin not found)
- [ ] `blindpay advance foo bar` — error "Unknown resource: foo. Use 'payout' or 'payin'."

---

## Webhook forwarding (with test-server.ts)

- [ ] Terminal 1: `bun run test-server.ts` — server listening on 3333
- [ ] Terminal 2: `blindpay mock --forward-to http://localhost:3333/webhooks`
- [ ] Terminal 3: `blindpay receivers create --email webhook@test.com` — test server logs POST, event receiver.new, Svix headers, body; signature line shows valid (green check) or invalid (red X)
- [ ] Terminal 3: `blindpay trigger payout.complete` — test server receives payout.complete payload, signature valid when secret matches (whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw)
- [ ] Webhook request includes headers: Svix-Id, Svix-Timestamp, Svix-Signature; body has webhook_event and event data
