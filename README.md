# @blindpay/cli

Blindpay CLI — manage receivers, bank accounts, payouts, payins, and more from the terminal.

## Installation

```bash
npm install -g @blindpay/cli
```

Or run directly with npx:

```bash
npx @blindpay/cli <command>
```

## Configuration

Set your API key and instance ID (from the [Blindpay dashboard](https://dashboard.blindpay.com)):

```bash
blindpay config set --api-key sk_live_... --instance-id inst_...
```

You can also use environment variables:

```bash
export BLINDPAY_API_KEY=sk_live_...
export BLINDPAY_INSTANCE_ID=inst_...
export BLINDPAY_API_URL=https://api.blindpay.com  # optional
```

View current config:

```bash
blindpay config get
```

## Quick Start

```bash
# Create a receiver
blindpay receivers create --email user@example.com --name "John Doe" --country US

# Add a bank account
blindpay bank_accounts create --receiver-id <id> --type ach \
  --routing-number 021000021 --account-number 123456789

# Create a quote and payout
blindpay quotes create --bank-account-id <id> --amount 5000 --network base --token USDC
blindpay payouts create --quote-id <id> --network evm

# Check payout status
blindpay payouts get <id>
```

## Commands

Every command supports `--help` for detailed usage and examples.

### Config

| Command | Description |
|---------|-------------|
| `config set` | Set API key, instance ID, or base URL |
| `config get` | Show current config (API key masked) |
| `config clear` | Remove saved config |
| `config path` | Print config file path |

### Receivers

| Command | Description |
|---------|-------------|
| `receivers list` | List all receivers |
| `receivers get <id>` | Get a receiver by ID |
| `receivers create` | Create a new receiver |
| `receivers update <id>` | Update a receiver |
| `receivers delete <id>` | Delete a receiver |

### Bank Accounts

| Command | Description |
|---------|-------------|
| `bank_accounts list` | List bank accounts (requires `--receiver-id`) |
| `bank_accounts get <id>` | Get a bank account (requires `--receiver-id`) |
| `bank_accounts create` | Create a bank account (requires `--receiver-id`) |
| `bank_accounts delete <id>` | Delete a bank account (requires `--receiver-id`) |

### Blockchain Wallets

| Command | Description |
|---------|-------------|
| `blockchain_wallets list` | List wallets (requires `--receiver-id`) |
| `blockchain_wallets get <id>` | Get a wallet (requires `--receiver-id`) |
| `blockchain_wallets create` | Create a wallet (requires `--receiver-id`, `--address`) |
| `blockchain_wallets delete <id>` | Delete a wallet (requires `--receiver-id`) |

### Quotes & Payouts

| Command | Description |
|---------|-------------|
| `quotes create` | Create a payout quote (requires `--bank-account-id`) |
| `payouts list` | List all payouts (optional `--status` filter) |
| `payouts get <id>` | Get a payout by ID |
| `payouts create` | Create a payout (requires `--quote-id`) |

### Payin Quotes & Payins

| Command | Description |
|---------|-------------|
| `payin_quotes create` | Create a payin quote (requires `--blockchain-wallet-id`, `--payment-method`) |
| `payins list` | List all payins |
| `payins get <id>` | Get a payin by ID |
| `payins create` | Create a payin (requires `--payin-quote-id`) |

### Webhook Endpoints

| Command | Description |
|---------|-------------|
| `webhook_endpoints list` | List webhook endpoints |
| `webhook_endpoints create` | Create a webhook endpoint (requires `--url`) |
| `webhook_endpoints delete <id>` | Delete a webhook endpoint |

### Partner Fees

| Command | Description |
|---------|-------------|
| `partner_fees list` | List partner fees |
| `partner_fees create` | Create a partner fee |
| `partner_fees delete <id>` | Delete a partner fee |

### API Keys

| Command | Description |
|---------|-------------|
| `api_keys list` | List API keys |
| `api_keys create` | Create an API key |
| `api_keys delete <id>` | Delete an API key |

### Virtual Accounts

| Command | Description |
|---------|-------------|
| `virtual_accounts list` | List virtual accounts (requires `--receiver-id`) |
| `virtual_accounts create` | Create a virtual account (requires `--receiver-id`, `--blockchain-wallet-id`) |

### Offramp Wallets

| Command | Description |
|---------|-------------|
| `offramp_wallets list` | List offramp wallets (requires `--receiver-id`, `--bank-account-id`) |

### Reference Data

| Command | Description |
|---------|-------------|
| `available rails` | List available payment rails |
| `available bank_details --rail <type>` | Show required fields for a rail |

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output as JSON (available on most commands) |
| `--version` | Show CLI version |
| `--help` | Show help |

## Updating

```bash
blindpay update
# or directly:
npm install -g @blindpay/cli@latest
```

## License

MIT
