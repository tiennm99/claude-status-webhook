# Setup Guide

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
- A [Telegram bot token](https://core.telegram.org/bots#how-do-i-create-a-bot) from [@BotFather](https://t.me/BotFather)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | [Cloudflare Workers](https://workers.cloudflare.com/) |
| Storage | [Cloudflare KV](https://developers.cloudflare.com/kv/) |
| Queue | [Cloudflare Queues](https://developers.cloudflare.com/queues/) |
| HTTP framework | [Hono](https://hono.dev/) |
| Telegram framework | [grammY](https://grammy.dev/) |

## Deployment

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

npx wrangler secret put ADMIN_CHAT_ID
# (Optional) Your Telegram chat ID — receive webhook error alerts via Telegram
# Use the bot's /info command to find your chat ID
```

### 5. Deploy

```bash
npm run deploy
```

Note the worker URL from the output (e.g., `https://claude-status-webhook.<your-subdomain>.workers.dev`).

### 6. Set up Telegram bot

Run the setup script to register bot commands and set the Telegram webhook:

```bash
node scripts/setup-bot.js
```

It will prompt for your bot token and worker URL. You should see `{"ok":true}` for both webhook and commands.

### 7. Configure Statuspage webhook

1. Go to [status.claude.com](https://status.claude.com/)
2. Click **Subscribe to Updates** → **Webhook**
3. Enter the webhook URL: `<WORKER_URL>/webhook/status/<WEBHOOK_SECRET>`

Replace `<WEBHOOK_SECRET>` with the secret you set in step 4.

## Local Development

```bash
npm run dev
```

This starts a local dev server with wrangler that emulates KV and Queues locally. Test with curl:

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
