# Feature Decisions

Suggested features evaluated during code review (April 2026). All declined for current scope — this is intentionally a simple, focused bot.

Ordered by likelihood of future implementation (top = most likely to revisit).

## Declined Features

### 1. Fan-Out Decoupling (Two-Phase Queue)

**Idea**: Webhook handler enqueues a single "dispatch" message; queue consumer lists subscribers and re-enqueues individual "deliver" messages. Converts O(N) webhook handler to O(1).

**Decision**: Skip. Current subscriber count is small. The webhook handler completing in one pass is simpler to reason about and debug. Adding a two-phase queue introduces message type routing, a new queue message schema, and makes the data flow harder to follow — all for a scaling problem that doesn't exist yet.

**Why this rank**: Clear trigger: webhook response times or CPU usage climbing in CF dashboard. Straightforward to implement when needed.

### 2. Queue Message Idempotency Keys

**Idea**: Include `{ incidentId, chatId }` hash as dedup key. Check short-TTL KV key before sending to prevent duplicate delivery on queue retries.

**Decision**: Skip. Duplicate notifications are a minor UX annoyance, not a correctness issue. Adding a KV read+write per message doubles KV operations in the queue consumer for a rare edge case (crash between successful Telegram send and `msg.ack()`). CF Queues retry is already bounded to 3 attempts.

**Why this rank**: Only worth it if users report duplicate notifications as a real problem.

### 3. /ping Command

**Idea**: Bot replies with worker region + timestamp for liveness check.

**Decision**: Skip. `/status` already proves the bot is alive (it fetches from external API and replies). A dedicated `/ping` adds another command for marginal value. The web health check endpoint (`GET /`) serves the same purpose for monitoring.

**Why this rank**: Trivial to add but not useful enough to justify another command.

### 4. Admin Commands (/stats)


**Idea**: `/stats` to show subscriber count, recent webhook events (useful for bot operator).

**Decision**: Skip. The bot has a small, known user base. Subscriber count can be checked via Cloudflare KV dashboard. Adding admin auth (allowlisted chat IDs) and stats tracking adds code for a rarely-used feature.

**Why highest**: Low effort, no architectural changes. Just a new command + `kv.list()` count. First thing to add if the bot grows.

### 5. Webhook HMAC Signature Verification

**Idea**: Verify Statuspage webhook payloads using HMAC signatures as a second auth layer beyond URL secret.

**Decision**: Skip. Atlassian Statuspage's public subscriber webhooks (the "Subscribe to Updates" → "Webhook" flow) do not provide HMAC signature headers. The only verification mechanism available is embedding a secret in the URL path, which this project already implements with timing-safe comparison. This is a platform limitation, not a design choice — if Atlassian adds signature support in the future (tracked as BCLOUD-14683), this should be revisited.

**Why this rank**: Not blocked by effort — blocked by platform. Would be implemented immediately if Atlassian ships HMAC support.

### 6. Proactive Rate Limit Tracking

**Idea**: Track per-chat message counts to stay within Telegram's rate limits proactively.

**Decision**: Skip. Current reactive approach (retry on 429, CF Queues backoff) is sufficient for the subscriber scale. Proactive tracking requires per-chat counters in KV with TTL, sliding window logic, and adds read/write overhead to every message send. Worth revisiting only if 429 errors become frequent at scale.

**Why this rank**: Becomes necessary at scale. Clear trigger: frequent 429 errors in logs.

### 7. Status Change Deduplication

**Idea**: If a component flaps (operational → degraded → operational in 2 minutes), debounce into one message.

**Decision**: Skip. Would require stateful tracking of recent events (timestamps per component in KV) and delayed sending via scheduled workers or Durable Objects. Adds significant complexity. Statuspage already debounces on their end to some extent. Users prefer knowing every state change for a service they depend on.

**Why this rank**: Useful if flapping becomes noisy. Moderate effort with clear user-facing benefit.

### 8. Inline Keyboard for /subscribe

**Idea**: Replace text commands with clickable buttons using grammY's inline keyboard support.

**Decision**: Skip. The bot targets a technical audience (developers monitoring Claude API). Text commands are sufficient and simpler to maintain. Inline keyboards add UI state management complexity (callback queries, button expiry) without meaningful UX gain for this user base.

**Why this rank**: Nice UX polish but not functional gap. grammY supports it well — moderate effort.

### 9. Scheduled Status Digest

**Idea**: CF Workers `scheduled` cron trigger sends a daily "all clear" or summary to subscribers.

**Decision**: Skip. A "nothing happened" message daily is noise. Users can run `/status` on demand. Adding cron introduces a new entry point, scheduling logic, and message formatting for a low-value feature.

**Why this rank**: Low user value. Only useful if users explicitly request daily summaries.

### 10. Mute Command (/mute \<duration>)

**Idea**: Temporarily pause notifications without unsubscribing (e.g., `/mute 2h`).

**Decision**: Skip. Same reasoning as digest mode — this is a real-time alerting bot. If users want silence, `/stop` and `/start` are simple enough. Adding mute requires duration parsing, TTL tracking in KV, and filtering logic during fan-out — complexity not justified for a simple bot.

**Why this rank**: Contradicts real-time purpose. `/stop` + `/start` is sufficient.

### 11. Multi-Language Support

**Idea**: At minimum English/Vietnamese support.

**Decision**: Skip. Status messages from Statuspage come in English. Bot messages are short and technical. Internationalization adds string management overhead disproportionate to the bot's scope.

**Why this rank**: Source data is English-only. Translating bot chrome while incidents stay English creates a mixed-language experience.

### 12. Web Dashboard

**Idea**: Replace the `/` health check with a status page showing subscriber count and recent webhook events.

**Decision**: Skip. The bot is the product, not a web app. A dashboard requires frontend code, event logging to KV, and maintenance for a feature only the operator would see. Cloudflare dashboard + Telegram already provide sufficient visibility.

**Why this rank**: Out of scope. The bot is the product — adding a web frontend changes the project's nature.

### 13. Dead Letter Queue for Failed Messages

**Idea**: After CF Queues exhausts 3 retries, persist failed messages to KV or a dedicated DLQ for debugging.

**Decision**: Skip. CF Workers already logs all queue consumer errors (including final retry failures) via the observability config. With 100% log sampling and persisted invocation logs, failed messages are visible in the Cloudflare Dashboard. Adding a KV-based DLQ introduces write overhead on every failure and cleanup logic for stale entries — not worth it when logs already provide the same visibility.

**Why this rank**: Logging is sufficient for current scale. Revisit only if log retention (3-day free tier) is too short for debugging patterns.

### 14. KV List Scalability (Subscriber Sharding)

**Idea**: Shard subscriber keys by event type (e.g., `sub:incident:{chatId}`, `sub:component:{chatId}`) to avoid listing all subscribers on every webhook.

**Decision**: Skip. Current `kv.list({ prefix: "sub:" })` pagination works for hundreds of subscribers. Sharding requires a KV schema migration, dual-write logic during transition, and doubles storage for subscribers who want both types. Not justified until `kv.list()` latency or cost becomes measurable.

**Why this rank**: Clear trigger: slow webhook response times at high subscriber counts. Migration path is straightforward when needed.

### 15. Digest / Quiet Mode

**Idea**: Batch notifications into a daily summary instead of instant alerts.

**Decision**: Skip. The bot's core purpose is real-time incident notification. Users subscribe specifically to know immediately when Claude goes down. A digest defeats the primary use case — if Claude API is having a major outage, a daily summary hours later is useless.

**Why lowest**: Directly contradicts the bot's reason to exist.
