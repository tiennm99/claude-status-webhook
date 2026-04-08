# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Telegram bot that forwards [status.claude.com](https://status.claude.com/) (Atlassian Statuspage) webhook notifications to subscribed users. Hosted on Cloudflare Workers.

## Commands

- `npm run dev` — Start local dev server (wrangler dev, emulates KV + Queues locally)
- `npm run deploy` — Deploy to Cloudflare Workers
- `npx wrangler deploy --dry-run` — Verify build without deploying
- `node scripts/setup-bot.js` — One-time: register bot commands + set Telegram webhook (requires BOT_TOKEN and WORKER_URL env vars)

No test framework configured yet. No linter configured.

## Secrets (set via `wrangler secret put`)

- `BOT_TOKEN` — Telegram bot token
- `WEBHOOK_SECRET` — Secret token in Statuspage webhook URL path
- `STATUSPAGE_HMAC_KEY` — HMAC key from Statuspage webhook settings (optional, for signature verification)

## Architecture

Cloudflare Workers with three entry points exported from `src/index.js`:
- **`fetch`** — Hono.js HTTP handler (routes below)
- **`queue`** — CF Queues consumer for fan-out message delivery
- **`scheduled`** — CF Cron Trigger (every 5 min) for status polling safety net

### Routes

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/` | inline | Health check |
| POST | `/webhook/telegram` | `bot-commands.js` | grammY `webhookCallback("cloudflare-mod")` |
| POST | `/webhook/status/:secret` | `statuspage-webhook.js` | Receives Statuspage webhooks (HMAC + URL secret) |
| GET | `/migrate/:secret` | inline | One-time KV migration (remove after use) |

### Data Flow

1. **Statuspage → Worker**: Webhook POST → verify HMAC signature (fallback: URL secret) → parse incident/component event → filter subscribers by type + component → `sendBatch` to CF Queue
2. **Cron → Worker**: Every 5 min → fetch summary → compare with `last-status` KV → notify on changes → update stored state
3. **Queue → Telegram**: Consumer processes batches of 30 → `sendMessage` via `telegram-api.js` helper → auto-removes blocked subscribers (403/400), retries on 429
4. **User → Bot**: Telegram webhook → grammY handles `/help`, `/start`, `/stop`, `/status`, `/subscribe`, `/history`, `/uptime` commands → reads/writes KV

### KV Storage

Per-subscriber keys (no read-modify-write races):
- `sub:{chatId}` → `{ types: ["incident", "component"], components: [] }`
- `sub:{chatId}:{threadId}` → `{ types: ["incident"], components: ["API"] }`

Special keys:
- `last-status` — JSON snapshot of component statuses for cron comparison

`kv-store.js` handles key building/parsing with `kv.list({ prefix: "sub:" })` pagination. `threadId` can be `0` (General topic), so null checks use `!= null`.

### Component-Specific Subscriptions

Subscribers can filter to specific components via `/subscribe component <name>`. Empty `components` array = all components (default). Filtering applies to both webhook and cron notifications.

### Supergroup Topic Support

Bot stores `message_thread_id` from the topic where `/start` was sent. Notifications and queue consumer include `message_thread_id` in `sendMessage` payload to target the correct topic.

## Key Dependencies

- **hono** — HTTP routing framework
- **grammy** — Telegram Bot API framework (webhook mode for CF Workers)
- **wrangler** — CF Workers CLI (dev/deploy)

## CF Bindings (wrangler.jsonc)

- `claude_status` — KV namespace
- `claude-status` — Queue producer/consumer (batch size 30, max retries 3)
- Cron: `*/5 * * * *` — triggers `scheduled` export every 5 minutes
