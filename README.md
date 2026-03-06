# @blindpay/cli

Local mock server and developer tools for the Blindpay API. Build and test your integrations without a sandbox account or internet connection.

## Installation

```bash
# npm
npm install -g @blindpay/cli

# bun
bun add -g @blindpay/cli

# or run directly
npx @blindpay/cli mock
```

## Quick Start

```bash
# Start the mock server
blindpay mock

# Start with webhook forwarding
blindpay mock --forward-to http://localhost:3000/api/webhooks
```

The mock server starts at `http://localhost:4242` with pre-seeded test data (1 instance, 2 receivers, 4 bank accounts, 3 blockchain wallets). Any valid API key will be accepted.

## Using with the SDK

```typescript
import { Blindpay } from '@blindpay/sdk'

const blindpay = new Blindpay({
  apiKey: 'any-key-works',
  baseUrl: 'http://localhost:4242',
})

// All SDK methods work against the mock server
const receivers = await blindpay.receivers.list()
const quote = await blindpay.quotes.create({ ... })
const payout = await blindpay.payouts.create({ ... })
```

## Commands

### `blindpay mock`

Start the local mock API server.

```bash
blindpay mock                                          # defaults: port 4242, auto-advance lifecycle
blindpay mock --port 8080                              # custom port
blindpay mock --forward-to http://localhost:3000/hook   # forward webhooks
blindpay mock --manual                                 # disable auto-advancement
blindpay mock --delay 5000                             # 5s between lifecycle stages
blindpay mock --delay 0                                # instant completion
```

| Option                       | Description                                | Default |
| ---------------------------- | ------------------------------------------ | ------- |
| `-p, --port <port>`          | Port to run on                             | `4242`  |
| `-f, --forward-to <urls...>` | Forward webhooks to these URLs             | none    |
| `-m, --manual`               | Disable auto-advancement of payouts/payins | `false` |
| `--delay <ms>`               | Delay between lifecycle stages             | `2000`  |

### `blindpay trigger`

Trigger a webhook event manually. Requires the mock server to be running with `--forward-to`.

```bash
blindpay trigger payout.complete
blindpay trigger payout.new
blindpay trigger payin.complete
blindpay trigger receiver.new

# Use a specific resource ID
blindpay trigger payout.complete --payout-id pa_xxxxx
blindpay trigger payin.new --payin-id pi_xxxxx
```

**Available events:** `payout.new`, `payout.update`, `payout.complete`, `payout.partnerFee`, `payin.new`, `payin.update`, `payin.complete`, `payin.partnerFee`, `receiver.new`, `receiver.update`, `bankAccount.new`, `blockchainWallet.new`, `tos.accept`, `limitIncrease.new`, `limitIncrease.update`, `virtualAccount.new`, `virtualAccount.complete`

### `blindpay advance`

Advance a payout or payin to the next lifecycle stage. Useful in `--manual` mode.

```bash
blindpay advance payout <id>
blindpay advance payout <id> --to completed
blindpay advance payout <id> --to failed

blindpay advance payin <id>
blindpay advance payin <id> --to completed
```

### `blindpay status`

Show the current in-memory data counts.

```bash
blindpay status
```

### `blindpay receivers`

Manage receivers (individuals or businesses).

```bash
blindpay receivers list
blindpay receivers list --json
blindpay receivers get re_mock_indiv01
blindpay receivers get re_mock_indiv01 --json

blindpay receivers create --email john@example.com
blindpay receivers create --email john@example.com --name "John Doe" --country US
blindpay receivers create --email john@example.com --first-name John --last-name Doe --country US
blindpay receivers create --email corp@example.com --type business --legal-name "Acme Corp" --country BR
blindpay receivers create --email user@example.com --kyc-status verifying

blindpay receivers delete re_xxxxx
```

### `blindpay bank_accounts`

Manage bank accounts linked to receivers.

```bash
blindpay bank_accounts list --receiver-id re_mock_indiv01
blindpay bank_accounts get ba_mock_ach001

# ACH account
blindpay bank_accounts create \
  --receiver-id re_mock_indiv01 \
  --type ach \
  --beneficiary-name "John Doe" \
  --routing-number 021000021 \
  --account-number 1234567890 \
  --account-type checking \
  --account-class individual

# PIX account
blindpay bank_accounts create \
  --receiver-id re_mock_bizz01 \
  --type pix \
  --pix-key 12345678000100 \
  --country BR

blindpay bank_accounts delete ba_xxxxx
```

### `blindpay blockchain_wallets`

Manage blockchain wallets linked to receivers.

```bash
blindpay blockchain_wallets list --receiver-id re_mock_indiv01
blindpay blockchain_wallets get bw_mock_evm001

blindpay blockchain_wallets create \
  --receiver-id re_mock_indiv01 \
  --address 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18 \
  --network base

blindpay blockchain_wallets delete bw_xxxxx
```

### `blindpay quotes`

Manage payout quotes and check FX rates.

```bash
blindpay quotes create --bank-account-id ba_mock_ach001
blindpay quotes create --bank-account-id ba_mock_ach001 --amount 5000 --network base --token USDC

# Check FX rate
blindpay quotes fx --from USDC --to BRL --amount 1000
```

### `blindpay payouts`

Create, list, and inspect payouts. Create a quote first with `blindpay quotes create`, then create the payout.

```bash
# Create a quote (requires bank account)
blindpay quotes create --bank-account-id ba_mock_ach001 --amount 1000

# Create payout from quote (EVM)
blindpay payouts create --quote-id qu_xxxxx
blindpay payouts create --quote-id qu_xxxxx --sender-wallet-address 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18

# List and get
blindpay payouts list
blindpay payouts list --status processing
blindpay payouts list --json
blindpay payouts get pa_xxxxx
```

### `blindpay payin_quotes`

Create a payin quote (required before creating a payin).

```bash
blindpay payin_quotes create --blockchain-wallet-id bw_mock_evm001 --payment-method pix
blindpay payin_quotes create --blockchain-wallet-id bw_mock_evm001 --payment-method ach --amount 5000 --currency USD
```

### `blindpay payins`

Create, list, and inspect payins. Create a payin quote first with `blindpay payin_quotes create`, then create the payin.

```bash
# Create payin quote, then payin
blindpay payin_quotes create --blockchain-wallet-id bw_mock_evm001 --payment-method pix
blindpay payins create --payin-quote-id pq_xxxxx
blindpay payins create --payin-quote-id pq_xxxxx --external-id my-ref-123

# List and get
blindpay payins list
blindpay payins list --json
blindpay payins get pi_xxxxx
```

### `blindpay webhook_endpoints`

Manage webhook endpoints.

```bash
blindpay webhook_endpoints list
blindpay webhook_endpoints create --url https://example.com/webhooks --description "My endpoint"
blindpay webhook_endpoints delete we_xxxxx
```

### `blindpay partner_fees`

Manage partner fees.

```bash
blindpay partner_fees list
blindpay partner_fees create \
  --payout-percentage 1.5 \
  --payout-flat 50 \
  --evm-wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18
blindpay partner_fees delete pf_xxxxx
```

### `blindpay api_keys`

Manage API keys. You can set the key name when creating (e.g. for identifying keys in the dashboard).

```bash
blindpay api_keys list
blindpay api_keys create --name "Production Key"
blindpay api_keys delete ak_xxxxx
```

### `blindpay virtual_accounts`

Manage virtual accounts.

```bash
blindpay virtual_accounts list --receiver-id re_mock_indiv01
blindpay virtual_accounts create --receiver-id re_mock_indiv01 --blockchain-wallet-id bw_mock_evm001
```

### `blindpay offramp_wallets`

List offramp wallets linked to bank accounts.

```bash
blindpay offramp_wallets list --receiver-id re_mock_indiv01 --bank-account-id ba_mock_ach001
```

### `blindpay available`

Reference data for payment rails and bank account fields.

```bash
# List all available payment rails
blindpay available rails
blindpay available rails --json

# Get required fields for a specific rail
blindpay available bank_details --rail ach
blindpay available bank_details --rail pix
blindpay available bank_details --rail wire
blindpay available bank_details --rail international_swift
blindpay available bank_details --rail spei_bitso
```

## Pre-seeded Test Data

The mock server starts with the following data:

| Resource          | ID                | Details                          |
| ----------------- | ----------------- | -------------------------------- |
| Instance          | `in_mock00000001` | Development instance             |
| Receiver          | `re_mock_indiv01` | John Doe (individual, US)        |
| Receiver          | `re_mock_bizz01`  | Acme Corp Ltda (business, BR)    |
| Bank Account      | `ba_mock_ach001`  | John ACH Account                 |
| Bank Account      | `ba_mock_pix001`  | Acme PIX Account                 |
| Bank Account      | `ba_mock_wire01`  | John Wire Account                |
| Bank Account      | `ba_mock_swift1`  | John SWIFT Account               |
| Blockchain Wallet | `bw_mock_evm001`  | EVM wallet (Base)                |
| Blockchain Wallet | `bw_mock_sol001`  | Solana wallet                    |
| Blockchain Wallet | `bw_mock_stl001`  | Stellar wallet                   |
| API Key           | `ak_mock_key001`  | `bpk_test_mock_key_blindpay_cli` |

## Webhook Verification

The mock server signs all webhook payloads using the [Svix](https://svix.com/) protocol. The signing secret is printed on startup:

```
whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw
```

Each webhook request includes these headers:

- `Svix-Id` - Unique message ID
- `Svix-Timestamp` - Unix timestamp
- `Svix-Signature` - HMAC-SHA256 signature (`v1,<base64>`)

Use the [Svix libraries](https://docs.svix.com/receiving/verifying-payloads/how).

## Payout Lifecycle

When a payout is created, it progresses through these stages automatically (unless `--manual` mode is enabled):

```
processing -> tracking_transaction: completed -> tracking_payment: completed -> completed
```

For SWIFT payouts, there's an additional `on_hold` stage for compliance documents:

```
processing -> tracking_transaction: completed -> on_hold (documents) -> completed
```

Use `blindpay advance payout <id>` to manually step through stages, or `--to completed`/`--to failed` to jump directly.

## Payin Lifecycle

```
processing -> tracking_payment: completed -> tracking_transaction: completed -> completed
```

## Global Options

All resource subcommands support `--json` for JSON output:

```bash
blindpay receivers list --json
blindpay bank_accounts get ba_mock_ach001 --json
```

## License

MIT
