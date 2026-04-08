# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Telegram bot that forwards [status.claude.com](https://status.claude.com/) (Atlassian Statuspage) webhook notifications to subscribed users. Hosted on Cloudflare Workers.

## Commands

- `npm run dev` — Start local dev server (wrangler dev, emulates KV + Queues locally)
- `npm run deploy` — Deploy to Cloudflare Workers
- `npx wrangler deploy --dry-run --outdir=dist` — Verify build without deploying

No test framework configured yet. No linter configured.

## Secrets (set via `wrangler secret put`)

- `BOT_TOKEN` — Telegram bot token
- `WEBHOOK_SECRET` — Secret token in Statuspage webhook URL path

## Architecture

Cloudflare Workers with two entry points exported from `src/index.js`:
- **`fetch`** — Hono.js HTTP handler (routes below)
- **`queue`** — CF Queues consumer for fan-out message delivery

### Routes

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| GET | `/` | inline | Health check |
| GET | `/webhook/setup/:secret` | `bot-setup.js` | One-time: register bot commands + set Telegram webhook |
| POST | `/webhook/telegram` | `bot-commands.js` | grammY `webhookCallback("cloudflare-mod")` |
| POST | `/webhook/status/:secret` | `statuspage-webhook.js` | Receives Statuspage webhooks |

### Data Flow

1. **Statuspage → Worker**: Webhook POST → validate secret (timing-safe) → parse incident/component event → filter subscribers by preference → `sendBatch` to CF Queue
2. **Queue → Telegram**: Consumer processes batches of 30 → `sendMessage` via raw fetch → auto-removes blocked subscribers (403/400), retries on 429
3. **User → Bot**: Telegram webhook → grammY handles `/help`, `/start`, `/stop`, `/status`, `/subscribe`, `/history`, `/uptime` commands → reads/writes KV

### KV Storage

Single key `subscribers` stores a JSON object keyed by composite subscriber ID:
- DM/group: `"chatId"` → `{ types: ["incident", "component"] }`
- Supergroup topic: `"chatId:threadId"` → `{ types: ["incident"] }`

`kv-store.js` handles key building/parsing — `threadId` can be `0` (General topic), so null checks use `!= null` not truthiness.

### Supergroup Topic Support

Bot stores `message_thread_id` from the topic where `/start` was sent. Notifications and queue consumer include `message_thread_id` in `sendMessage` payload to target the correct topic.

## Key Dependencies

- **hono** — HTTP routing framework
- **grammy** — Telegram Bot API framework (webhook mode for CF Workers)
- **wrangler** — CF Workers CLI (dev/deploy)

## CF Bindings (wrangler.jsonc)

- `claude_status` — KV namespace
- `claude-status` — Queue producer/consumer (batch size 30, max retries 3)
