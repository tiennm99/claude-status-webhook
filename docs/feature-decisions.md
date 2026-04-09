# Feature Decisions

Suggested features evaluated during code review (April 2026). All declined for current scope — this is intentionally a simple, focused bot.

Ordered by likelihood of future implementation (top = most likely to revisit).

## Declined Features

### 1. Admin Commands (/stats)

**Idea**: `/stats` to show subscriber count, recent webhook events (useful for bot operator).

**Decision**: Skip. The bot has a small, known user base. Subscriber count can be checked via Cloudflare KV dashboard. Adding admin auth (allowlisted chat IDs) and stats tracking adds code for a rarely-used feature.

**Why highest**: Low effort, no architectural changes. Just a new command + `kv.list()` count. First thing to add if the bot grows.

### 2. Webhook HMAC Signature Verification

**Idea**: Verify Statuspage webhook payloads using HMAC signatures as a second auth layer beyond URL secret.

**Decision**: Skip. Atlassian Statuspage's public subscriber webhooks (the "Subscribe to Updates" → "Webhook" flow) do not provide HMAC signature headers. The only verification mechanism available is embedding a secret in the URL path, which this project already implements with timing-safe comparison. This is a platform limitation, not a design choice — if Atlassian adds signature support in the future (tracked as BCLOUD-14683), this should be revisited.

**Why this rank**: Not blocked by effort — blocked by platform. Would be implemented immediately if Atlassian ships HMAC support.

### 3. Proactive Rate Limit Tracking

**Idea**: Track per-chat message counts to stay within Telegram's rate limits proactively.

**Decision**: Skip. Current reactive approach (retry on 429, CF Queues backoff) is sufficient for the subscriber scale. Proactive tracking requires per-chat counters in KV with TTL, sliding window logic, and adds read/write overhead to every message send. Worth revisiting only if 429 errors become frequent at scale.

**Why this rank**: Becomes necessary at scale. Clear trigger: frequent 429 errors in logs.

### 4. Status Change Deduplication

**Idea**: If a component flaps (operational → degraded → operational in 2 minutes), debounce into one message.

**Decision**: Skip. Would require stateful tracking of recent events (timestamps per component in KV) and delayed sending via scheduled workers or Durable Objects. Adds significant complexity. Statuspage already debounces on their end to some extent. Users prefer knowing every state change for a service they depend on.

**Why this rank**: Useful if flapping becomes noisy. Moderate effort with clear user-facing benefit.

### 5. Inline Keyboard for /subscribe

**Idea**: Replace text commands with clickable buttons using grammY's inline keyboard support.

**Decision**: Skip. The bot targets a technical audience (developers monitoring Claude API). Text commands are sufficient and simpler to maintain. Inline keyboards add UI state management complexity (callback queries, button expiry) without meaningful UX gain for this user base.

**Why this rank**: Nice UX polish but not functional gap. grammY supports it well — moderate effort.

### 6. Scheduled Status Digest

**Idea**: CF Workers `scheduled` cron trigger sends a daily "all clear" or summary to subscribers.

**Decision**: Skip. A "nothing happened" message daily is noise. Users can run `/status` on demand. Adding cron introduces a new entry point, scheduling logic, and message formatting for a low-value feature.

**Why this rank**: Low user value. Only useful if users explicitly request daily summaries.

### 7. Mute Command (/mute \<duration>)

**Idea**: Temporarily pause notifications without unsubscribing (e.g., `/mute 2h`).

**Decision**: Skip. Same reasoning as digest mode — this is a real-time alerting bot. If users want silence, `/stop` and `/start` are simple enough. Adding mute requires duration parsing, TTL tracking in KV, and filtering logic during fan-out — complexity not justified for a simple bot.

**Why this rank**: Contradicts real-time purpose. `/stop` + `/start` is sufficient.

### 8. Multi-Language Support

**Idea**: At minimum English/Vietnamese support.

**Decision**: Skip. Status messages from Statuspage come in English. Bot messages are short and technical. Internationalization adds string management overhead disproportionate to the bot's scope.

**Why this rank**: Source data is English-only. Translating bot chrome while incidents stay English creates a mixed-language experience.

### 9. Web Dashboard

**Idea**: Replace the `/` health check with a status page showing subscriber count and recent webhook events.

**Decision**: Skip. The bot is the product, not a web app. A dashboard requires frontend code, event logging to KV, and maintenance for a feature only the operator would see. Cloudflare dashboard + Telegram already provide sufficient visibility.

**Why this rank**: Out of scope. The bot is the product — adding a web frontend changes the project's nature.

### 10. Digest / Quiet Mode

**Idea**: Batch notifications into a daily summary instead of instant alerts.

**Decision**: Skip. The bot's core purpose is real-time incident notification. Users subscribe specifically to know immediately when Claude goes down. A digest defeats the primary use case — if Claude API is having a major outage, a daily summary hours later is useless.

**Why lowest**: Directly contradicts the bot's reason to exist.
