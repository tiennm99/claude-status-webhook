# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Telegram bot that forwards [status.claude.com](https://status.claude.com/) (Atlassian Statuspage) webhook notifications to subscribed users. Hosted on Cloudflare Workers.

## Commands

- `npm run dev` — Start local dev server (wrangler dev, emulates KV + Queues locally)
- `npm run deploy` — Deploy to Cloudflare Workers
- `npx wrangler deploy --dry-run` — Verify build without deploying
- `node scripts/setup-bot.js` — One-time: register bot commands + set Telegram webhook (interactive prompts)

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
| POST | `/webhook/telegram` | `bot-commands.js` | grammY `webhookCallback("cloudflare-mod")` |
| POST | `/webhook/status/:secret` | `statuspage-webhook.js` | Receives Statuspage webhooks (URL secret) |

### Data Flow

1. **Statuspage → Worker**: Webhook POST → verify URL secret (timing-safe via `crypto-utils.js`) → parse incident/component event → filter subscribers by type + component → `sendBatch` to CF Queue
2. **Queue → Telegram**: Consumer processes batches of 30 → `sendMessage` via `telegram-api.js` helper → auto-removes blocked subscribers (403/400), retries on 429
3. **User → Bot**: Telegram webhook → grammY handles `/help`, `/start`, `/stop`, `/status`, `/subscribe`, `/history`, `/uptime` commands → reads/writes KV

### KV Storage

Per-subscriber keys (no read-modify-write races):
- `sub:{chatId}` → `{ types: ["incident", "component"], components: [] }`
- `sub:{chatId}:{threadId}` → `{ types: ["incident"], components: ["API"] }`

`kv-store.js` handles key building/parsing with `kv.list({ prefix: "sub:" })` pagination. Subscriber type/component data is stored as KV metadata so `getSubscribersByType()` uses only `list()` (O(1)) instead of individual `get()` calls. `threadId` can be `0` (General topic), so null checks use `!= null`.

### Component-Specific Subscriptions

Subscribers can filter to specific components via `/subscribe component <name>`. Empty `components` array = all components (default). Filtering applies to webhook notifications.

### Supergroup Topic Support

Bot stores `message_thread_id` from the topic where `/start` was sent. Notifications and queue consumer include `message_thread_id` in `sendMessage` payload to target the correct topic.

## Key Dependencies

- **hono** — HTTP routing framework
- **grammy** — Telegram Bot API framework (webhook mode for CF Workers)
- **wrangler** — CF Workers CLI (dev/deploy)

## CF Bindings (wrangler.jsonc)

- `claude_status` — KV namespace
- `claude-status` — Queue producer/consumer (batch size 30, max retries 3)

## Documentation

Detailed docs live in `docs/`:
- `docs/setup-guide.md` — Prerequisites, deployment, local dev
- `docs/system-architecture.md` — Entry points, data flow, KV schema, queue, security
- `docs/feature-decisions.md` — Evaluated features and rationale for decisions

## Code Guidelines

Prefer well-established npm packages over hand-written utilities for common operations
(e.g., date formatting, validation, string manipulation). Only write custom utils when
the logic is trivial (< 5 lines) or platform-specific (e.g., CF Workers crypto APIs).

## README Guidelines

Keep `README.md` clean and focused: project intro, features, commands, quick start, and links to docs.
Move detailed setup, architecture, and decision records to `docs/`. Do not bloat the README with
step-by-step instructions or implementation details.
