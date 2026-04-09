# claude-status-webhook

Telegram bot that forwards [Claude Status](https://status.claude.com/) updates to subscribed users. Instant notifications when Claude goes down — incidents, component changes, and resolutions.

Fully serverless on [Cloudflare Workers](https://workers.cloudflare.com/) (free tier). Zero infrastructure to manage.

## Features

- **Real-time incident alerts** — new incidents, updates, and resolutions with impact severity
- **Component status changes** — e.g., API goes from Operational → Degraded Performance
- **Subscription preferences** — incidents only, components only, or both
- **Component filtering** — subscribe to specific components (e.g., API only)
- **Supergroup topic support** — notifications routed to the topic where `/start` was sent
- **Live status check** — `/status` fetches current data from status.claude.com
- **Self-healing** — automatically removes subscribers who block the bot

## Bot Commands

| Command | Description |
|---------|-------------|
| `/help` | Detailed command guide with examples |
| `/start` | Subscribe to notifications |
| `/stop` | Unsubscribe from notifications |
| `/status [name]` | Current system status (optionally for a specific component) |
| `/subscribe <type>` | Set preferences: `incident`, `component`, or `all` |
| `/subscribe component <name>` | Filter to a specific component |
| `/history [count]` | Recent incidents (default 5, max 10) |
| `/uptime` | Component health overview |

## Quick Start

```bash
git clone https://github.com/tiennm99/claude-status-webhook.git
cd claude-status-webhook
npm install
```

See [Setup Guide](docs/setup-guide.md) for full deployment instructions.

## Documentation

| Doc | Description |
|-----|-------------|
| [Setup Guide](docs/setup-guide.md) | Prerequisites, deployment, Telegram & Statuspage configuration |
| [System Architecture](docs/system-architecture.md) | Entry points, data flow, KV schema, queue processing |
| [Feature Decisions](docs/feature-decisions.md) | Evaluated features and rationale for decisions |

## License

[Apache-2.0](LICENSE)
