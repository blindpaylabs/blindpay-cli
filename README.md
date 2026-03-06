<h1>BlindPay CLI <img src="https://github.com/user-attachments/assets/c42b121d-adf1-467c-88ce-6f5be1efa93c" align="right" width="102"/></h1>

[![chat on Discord](https://img.shields.io/discord/856971667393609759.svg?logo=discord)](https://discord.gg/x7ap6Gkbe9)
[![twitter](https://img.shields.io/twitter/follow/blindpaylabs?style=social)](https://twitter.com/intent/follow?screen_name=blindpaylabs)
[![npm version](https://img.shields.io/npm/v/@blindpay/cli)](https://www.npmjs.com/package/@blindpay/cli)

The official CLI for [BlindPay](https://blindpay.com) - Stablecoin API for global payments.

## Installation

```bash
npm install -g @blindpay/cli
```

Or run without installing:

```bash
npx @blindpay/cli <command>
```

## Setup

Grab your API key and instance ID from the [BlindPay dashboard](https://app.blindpay.com) and run:

```bash
blindpay config set --api-key sk_live_... --instance-id inst_...
```

That's it. Alternatively, set environment variables:

```bash
export BLINDPAY_API_KEY=sk_live_...
export BLINDPAY_INSTANCE_ID=inst_...
```

## Quick start

```bash
# Create a receiver
blindpay receivers create --email john@example.com --name "John Doe" --country US

# Add a bank account
blindpay bank_accounts create --receiver-id re_xxx --type ach \
  --routing-number 021000021 --account-number 123456789

# Get a quote and execute a payout
blindpay quotes create --bank-account-id ba_xxx --amount 5000 --token USDC
blindpay payouts create --quote-id qt_xxx --sender-wallet-address 0x...

# Check status
blindpay payouts get po_xxx
```

## Commands

Every command supports `--help` for detailed usage and `--json` for machine-readable output.

```
blindpay config set|get|clear|path       Configure API credentials
blindpay receivers list|get|create|update|delete
blindpay bank_accounts list|get|create|delete    (--receiver-id required)
blindpay blockchain_wallets list|get|create|delete (--receiver-id required)
blindpay quotes create                   Create a payout quote
blindpay payouts list|get|create         Execute stablecoin-to-fiat payouts
blindpay payin_quotes create             Create a payin quote
blindpay payins list|get|create          Execute fiat-to-stablecoin payins
blindpay webhook_endpoints list|create|delete
blindpay partner_fees list|create|delete
blindpay api_keys list|create|delete
blindpay virtual_accounts list|create    (--receiver-id required)
blindpay offramp_wallets list            (--receiver-id + --bank-account-id)
blindpay available rails                 List supported payment rails
blindpay available bank_details --rail ach  Required fields per rail
blindpay schema [resource]               Introspect field schemas (for LLM/automation)
blindpay update                          Print update instructions
```

## LLM / automation support

The CLI is designed to work well with LLMs and scripts:

- **`--json`** on any command for structured output
- **`blindpay schema`** returns field definitions, types, defaults, and enums as JSON
- **Exit codes**: `0` success, `1` user error, `2` API error
- **Structured errors** when `--json` is active:
  ```json
  {"error": true, "message": "...", "exitCode": 2, "statusCode": 401}
  ```

For full MCP tool server integration, see [blindpay-mcp](https://github.com/blindpaylabs/blindpay-mcp).

## Updating

```bash
blindpay update
# or:
npm install -g @blindpay/cli@latest
```

## License

MIT
