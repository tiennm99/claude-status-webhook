# claude-status-webhook

Telegram bot that forwards [Claude Status](https://status.claude.com/) updates to subscribed users. Whenever an incident or component status change occurs on Claude's status page, subscribers receive a Telegram notification instantly.

Hosted on [Cloudflare Workers](https://workers.cloudflare.com/) with KV for storage and Queues for reliable message fan-out. Fully serverless, fully free tier.

## Features

- **Incident notifications** — new incidents, updates, and resolutions with impact severity
- **Component status changes** — e.g., API goes from Operational → Degraded Performance
- **Per-user subscription preferences** — subscribe to incidents only, components only, or both
- **Component-specific filtering** — subscribe to specific components (e.g., API only)
- **Supergroup topic support** — send `/start` in a specific topic and notifications go to that topic
- **On-demand status check** — `/status` fetches live data from status.claude.com
- **Self-healing** — automatically removes subscribers who block the bot

## Bot Commands

| Command | Description |
|---------|-------------|
| `/help` | Detailed command guide with examples |
| `/start` | Subscribe to notifications (default: incidents + components) |
| `/stop` | Unsubscribe from notifications |
| `/status` | Show current status with overall indicator and all components |
| `/status <name>` | Show status of a specific component (fuzzy match) |
| `/subscribe incident` | Receive incident notifications only |
| `/subscribe component` | Receive component update notifications only |
| `/subscribe component <name>` | Filter to a specific component (e.g., `/subscribe component api`) |
| `/subscribe component all` | Clear component filter (receive all) |
| `/subscribe all` | Receive both incidents and components (default) |
| `/history` | Show 5 most recent incidents with impact and links |
| `/history <count>` | Show up to 10 recent incidents |
| `/uptime` | Component health overview with last status change time |

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
- A [Telegram bot token](https://core.telegram.org/bots#how-do-i-create-a-bot) from [@BotFather](https://t.me/BotFather)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/tiennm99/claude-status-webhook.git
cd claude-status-webhook
npm install
```

### 2. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 3. Create KV namespace and Queue

```bash
npx wrangler kv namespace create claude-status
npx wrangler queues create claude-status
```

Copy the KV namespace ID from the output and update `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  { "binding": "claude_status", "id": "YOUR_KV_NAMESPACE_ID" }
]
```

### 4. Set secrets

```bash
npx wrangler secret put BOT_TOKEN
# Paste your Telegram bot token

npx wrangler secret put WEBHOOK_SECRET
# Choose a random secret string for the Statuspage webhook URL
```

### 5. Deploy

```bash
npm run deploy
```

Note the worker URL from the output (e.g., `https://claude-status-webhook.<your-subdomain>.workers.dev`).

### 6. Set up Telegram bot

Run the setup script to register bot commands and set the Telegram webhook:

```bash
BOT_TOKEN=your-token WORKER_URL=https://your-worker.workers.dev node scripts/setup-bot.js
```

You should see `{"ok":true}` for both webhook and commands.

### 7. Configure Statuspage webhook

1. Go to [status.claude.com](https://status.claude.com/)
2. Click **Subscribe to Updates** → **Webhook**
3. Enter the webhook URL: `<WORKER_URL>/webhook/status/<WEBHOOK_SECRET>`

Replace `<WEBHOOK_SECRET>` with the secret you set in step 4.

### 8. Run migration (if upgrading)

If you have existing subscribers from an older version, run the migration endpoint once:

```bash
curl -X POST https://<WORKER_URL>/migrate/<WEBHOOK_SECRET>
```

This converts the old single-key format to per-subscriber KV keys. Remove the `/migrate` route from `src/index.js` after confirming success.

## Local Development

```bash
npm run dev
```

This starts a local dev server with wrangler that emulates KV and Queues locally. You can test the Statuspage webhook with curl:

```bash
# Test incident webhook
curl -X POST http://localhost:8787/webhook/status/your-test-secret \
  -H "Content-Type: application/json" \
  -d '{
    "meta": { "event_type": "incident.created" },
    "incident": {
      "name": "API Degraded Performance",
      "status": "investigating",
      "impact": "major",
      "shortlink": "https://stspg.io/xxx",
      "incident_updates": [{ "body": "We are investigating the issue.", "status": "investigating" }]
    }
  }'

# Test component webhook
curl -X POST http://localhost:8787/webhook/status/your-test-secret \
  -H "Content-Type: application/json" \
  -d '{
    "meta": { "event_type": "component.updated" },
    "component": { "name": "API", "status": "degraded_performance" },
    "component_update": { "old_status": "operational", "new_status": "degraded_performance" }
  }'
```

## Tech Stack

- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Storage**: [Cloudflare KV](https://developers.cloudflare.com/kv/)
- **Queue**: [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- **HTTP framework**: [Hono](https://hono.dev/)
- **Telegram framework**: [grammY](https://grammy.dev/)

## License

[Apache-2.0](LICENSE)
