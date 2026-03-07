<h1>BlindPay CLI <img src="https://github.com/user-attachments/assets/c42b121d-adf1-467c-88ce-6f5be1efa93c" align="right" width="102"/></h1>

[![chat on Discord](https://img.shields.io/discord/856971667393609759.svg?logo=discord)](https://discord.gg/x7ap6Gkbe9)
[![twitter](https://img.shields.io/twitter/follow/blindpay?style=social)](https://twitter.com/intent/follow?screen_name=blindpay)
[![npm version](https://img.shields.io/npm/v/@blindpay/cli)](https://www.npmjs.com/package/@blindpay/cli)

The official CLI for [BlindPay](https://blindpay.com) - Stablecoin API for global payments.

## Installation

```bash
npm install -g @blindpay/cli
```

```bash
bun add -g @blindpay/cli
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

Alternatively, set environment variables:

```bash
export BLINDPAY_API_KEY=sk_live_...
export BLINDPAY_INSTANCE_ID=inst_...
```

## Commands

Every command supports `--help` for detailed usage and `--json` for machine-readable output.

### Config

| Command | Description |
|---|---|
| `blindpay config set` | Set API key, instance ID, or base URL |
| `blindpay config get` | Show current config (API key masked) |
| `blindpay config clear` | Remove saved config |
| `blindpay config path` | Print config file path |

### Instances

| Command | Description |
|---|---|
| `blindpay instances update` | Update instance name or redirect URL |
| `blindpay instances members list` | List instance members |

### Receivers

| Command | Description |
|---|---|
| `blindpay receivers list` | List all receivers |
| `blindpay receivers get <id>` | Get a receiver by ID |
| `blindpay receivers create` | Create a new receiver |
| `blindpay receivers update <id>` | Update a receiver |
| `blindpay receivers delete <id>` | Delete a receiver |
| `blindpay receivers limits <id>` | Get receiver limits |
| `blindpay receivers limits_increase_requests <id>` | Get limits increase requests |

### Bank Accounts

Requires `--receiver-id` on every command.

| Command | Description |
|---|---|
| `blindpay bank_accounts list` | List bank accounts for a receiver |
| `blindpay bank_accounts get <id>` | Get a bank account by ID |
| `blindpay bank_accounts create` | Create a new bank account |
| `blindpay bank_accounts delete <id>` | Delete a bank account |

### Blockchain Wallets

Requires `--receiver-id` on every command.

| Command | Description |
|---|---|
| `blindpay blockchain_wallets list` | List blockchain wallets for a receiver |
| `blindpay blockchain_wallets get <id>` | Get a blockchain wallet by ID |
| `blindpay blockchain_wallets create` | Create a new blockchain wallet |
| `blindpay blockchain_wallets delete <id>` | Delete a blockchain wallet |

### Payouts

| Command | Description |
|---|---|
| `blindpay quotes create` | Create a payout quote |
| `blindpay quotes fx` | Get FX rates |
| `blindpay payouts list` | List all payouts |
| `blindpay payouts get <id>` | Get a payout by ID |
| `blindpay payouts create` | Execute a payout from a quote |

### Payins

| Command | Description |
|---|---|
| `blindpay payin_quotes create` | Create a payin quote |
| `blindpay payin_quotes fx` | Get FX rates |
| `blindpay payins list` | List all payins |
| `blindpay payins get <id>` | Get a payin by ID |
| `blindpay payins create` | Execute a payin from a quote |

### Virtual Accounts

Requires `--receiver-id` on every command.

| Command | Description |
|---|---|
| `blindpay virtual_accounts list` | List virtual accounts for a receiver |
| `blindpay virtual_accounts create` | Create a virtual account |

### Offramp Wallets

| Command | Description |
|---|---|
| `blindpay offramp_wallets list` | List offramp wallets (`--receiver-id` + `--bank-account-id`) |

### Webhook Endpoints

| Command | Description |
|---|---|
| `blindpay webhook_endpoints list` | List webhook endpoints |
| `blindpay webhook_endpoints create` | Create a webhook endpoint |
| `blindpay webhook_endpoints delete <id>` | Delete a webhook endpoint |

### Partner Fees

| Command | Description |
|---|---|
| `blindpay partner_fees list` | List partner fees |
| `blindpay partner_fees create` | Create a partner fee |
| `blindpay partner_fees delete <id>` | Delete a partner fee |

### API Keys

| Command | Description |
|---|---|
| `blindpay api_keys list` | List API keys |
| `blindpay api_keys create` | Create an API key |
| `blindpay api_keys delete <id>` | Delete an API key |

### Reference Data

| Command | Description |
|---|---|
| `blindpay available rails` | List supported payment rails |
| `blindpay available bank_details --rail <rail>` | Required fields per rail |

### Tooling

| Command | Description |
|---|---|
| `blindpay schema` | List all resources and their commands |
| `blindpay schema <resource>` | Field definitions for a resource (JSON) |
| `blindpay update` | Print update instructions |

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

## Support

- Email: [alves@blindpay.com](mailto:alves@blindpay.com)
- Issues: [GitHub Issues](https://github.com/blindpaylabs/blindpay-cli/issues)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Made with ❤️ by the [BlindPay](https://blindpay.com) team
