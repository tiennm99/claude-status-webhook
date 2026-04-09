# System Architecture

Telegram bot forwarding [status.claude.com](https://status.claude.com/) (Atlassian Statuspage) webhook notifications to subscribed users. Hosted on Cloudflare Workers.

## Overview

```
Statuspage ──POST──► CF Worker (fetch) ──► CF Queue ──► CF Worker (queue) ──► Telegram API
                          │                                                        │
Telegram ──POST──► Bot commands                                                    ▼
                          │                                              User receives message
                          ▼
                     Cloudflare KV
```

## Entry Points

The worker exports two handlers from `src/index.js`:

| Handler | Trigger | Purpose |
|---------|---------|---------|
| `fetch` | HTTP request | Hono.js router — serves health check, Telegram webhook, Statuspage webhook |
| `queue` | CF Queue batch | Processes queued messages, sends each to Telegram API |

## HTTP Routes

| Method | Path | File | Purpose |
|--------|------|------|---------|
| GET | `/` | `index.js` | Health check |
| POST | `/webhook/telegram` | `bot-commands.js` | grammY `webhookCallback` — processes bot commands |
| POST | `/webhook/status/:secret` | `statuspage-webhook.js` | Receives Statuspage webhooks, validates URL secret |

A middleware in `index.js` normalizes double slashes in URL paths (Statuspage occasionally sends `//webhook/...`).

## Data Flow

### Statuspage → Subscribers

1. **Receive**: Statuspage POSTs incident/component event to `/webhook/status/:secret`
2. **Validate**: URL secret verified via timing-safe comparison (SHA-256 hashed, `crypto-utils.js`)
3. **Parse**: Extract event type (`incident.*` or `component.*`), format HTML message
4. **Filter**: Query KV for subscribers matching event type + component filter (`kv-store.js`)
5. **Enqueue**: Batch messages into CF Queue (100 per `sendBatch` call)
6. **Deliver**: Queue consumer sends each message to Telegram API (`queue-consumer.js`)
7. **Self-heal**: On 403/400 (bot blocked/chat deleted), subscriber auto-removed from KV

### User → Bot

1. Telegram POSTs update to `/webhook/telegram`
2. grammY framework routes to command handler
3. Command reads/writes KV as needed
4. Bot replies directly via grammY context

## Source Files

| File | Lines | Responsibility |
|------|-------|---------------|
| `index.js` | ~30 | Hono router, path normalization middleware, export handlers |
| `bot-commands.js` | ~155 | `/start`, `/stop`, `/subscribe` — subscription management (cached Bot instance) |
| `bot-info-commands.js` | ~125 | `/help`, `/status`, `/history`, `/uptime` — read-only info |
| `statuspage-webhook.js` | ~85 | Webhook validation, event parsing, subscriber fan-out |
| `queue-consumer.js` | ~65 | Batch message delivery, retry/removal logic |
| `kv-store.js` | ~140 | KV key management, subscriber CRUD, filtered listing |
| `status-fetcher.js` | ~120 | Statuspage API client, HTML formatters, status helpers |
| `crypto-utils.js` | ~12 | Timing-safe string comparison (SHA-256 hashed) |
| `telegram-api.js` | ~9 | Telegram Bot API URL builder |

## KV Storage

Namespace binding: `claude_status`

### Key Format

- `sub:{chatId}` — direct chat or group (no topic)
- `sub:{chatId}:{threadId}` — supergroup topic (`threadId` can be `0` for General topic)

### Value

```json
{ "types": ["incident", "component"], "components": ["API"] }
```

- `types`: which event categories to receive
- `components`: component name filter (empty array = all components)

### Metadata

Same shape as value — stored as KV key metadata so `getSubscribersByType()` uses only `kv.list()` (reads metadata from listing) instead of individual `kv.get()` calls. This is O(1) list calls vs O(N) get calls.

## Queue Processing

Binding: `claude-status` queue

- **Batch size**: 30 messages per consumer invocation
- **Max retries**: 3 (configured in `wrangler.jsonc`)
- **429 handling**: `msg.retry()` with CF Queues backoff; `Retry-After` header logged
- **5xx handling**: `msg.retry()` for transient Telegram server errors
- **403/400 handling**: subscriber removed from KV, message acknowledged
- **Network errors**: `msg.retry()` for transient failures

## Observability

Enabled via `wrangler.jsonc` `observability` config. Automatic — no code changes required.

- **Logs**: All `console.log`/`console.error` calls, request metadata, exceptions. Persisted with invocation logs enabled. Free tier: 200k logs/day, 3-day retention.
- **Traces**: Automatic instrumentation of fetch calls, KV reads, queue operations. Persisted.
- **Sampling**: 100% (`head_sampling_rate: 1`) for both logs and traces — reduce for high-volume scenarios
- **Dashboard**: Cloudflare Dashboard → Workers → Observability

## Security

- **Statuspage webhook always-200**: Handler always returns HTTP 200 (even on errors) to prevent Statuspage from removing the webhook subscription. Errors are logged, not surfaced as HTTP status codes.
- **Statuspage webhook auth**: URL path secret validated with timing-safe SHA-256 comparison
- **Telegram webhook**: Registered via `setup-bot.js` — Telegram only sends to the registered URL
- **No secrets in code**: `BOT_TOKEN` and `WEBHOOK_SECRET` stored as Cloudflare secrets
- **HTML injection**: All user/external strings passed through `escapeHtml()` before Telegram HTML rendering

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP routing framework (lightweight, CF Workers native) |
| `grammy` | Telegram Bot API framework (webhook mode) |
| `wrangler` | CF Workers CLI (dev/deploy, dev dependency) |
