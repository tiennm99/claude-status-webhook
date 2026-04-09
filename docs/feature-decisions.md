# Feature Decisions

Suggested features evaluated during code review (April 2026). Each was declined with rationale documented here for future reference.

## Declined Features

### 1. Digest / Quiet Mode

**Idea**: Batch notifications into a daily summary instead of instant alerts.

**Decision**: Skip. The bot's core purpose is real-time incident notification. Users subscribe specifically to know immediately when Claude goes down. A digest defeats the primary use case — if Claude API is having a major outage, a daily summary hours later is useless.

### 2. Inline Keyboard for /subscribe

**Idea**: Replace text commands with clickable buttons using grammY's inline keyboard support.

**Decision**: Skip. The bot targets a technical audience (developers monitoring Claude API). Text commands are sufficient and simpler to maintain. Inline keyboards add UI state management complexity (callback queries, button expiry) without meaningful UX gain for this user base.

### 3. Mute Command (/mute \<duration>)

**Idea**: Temporarily pause notifications without unsubscribing (e.g., `/mute 2h`).

**Decision**: Skip. Same reasoning as digest mode — this is a real-time alerting bot. If users want silence, `/stop` and `/start` are simple enough. Adding mute requires duration parsing, TTL tracking in KV, and filtering logic during fan-out — complexity not justified for a simple bot.

### 4. Status Change Deduplication

**Idea**: If a component flaps (operational → degraded → operational in 2 minutes), debounce into one message.

**Decision**: Skip. Would require stateful tracking of recent events (timestamps per component in KV) and delayed sending via scheduled workers or Durable Objects. Adds significant complexity. Statuspage already debounces on their end to some extent. Users prefer knowing every state change for a service they depend on.

### 5. Scheduled Status Digest

**Idea**: CF Workers `scheduled` cron trigger sends a daily "all clear" or summary to subscribers.

**Decision**: Skip. A "nothing happened" message daily is noise. Users can run `/status` on demand. Adding cron introduces a new entry point, scheduling logic, and message formatting for a low-value feature.

### 6. Admin Commands (/stats)

**Idea**: `/stats` to show subscriber count, recent webhook events (useful for bot operator).

**Decision**: Skip. The bot has a small, known user base. Subscriber count can be checked via Cloudflare KV dashboard. Adding admin auth (allowlisted chat IDs) and stats tracking adds code for a rarely-used feature.

### 7. Multi-Language Support

**Idea**: At minimum English/Vietnamese support.

**Decision**: Skip. Status messages from Statuspage come in English. Bot messages are short and technical. Internationalization adds string management overhead disproportionate to the bot's scope.

### 8. Webhook HMAC Signature Verification

**Idea**: Verify Statuspage webhook payloads using HMAC signatures as a second auth layer beyond URL secret.

**Decision**: Skip. Atlassian Statuspage does not provide HMAC signature headers for webhook deliveries. The URL secret is the only auth mechanism they support. If they add signature support in the future, this should be revisited.

### 9. Proactive Rate Limit Tracking

**Idea**: Track per-chat message counts to stay within Telegram's rate limits proactively.

**Decision**: Skip. Current reactive approach (retry on 429, CF Queues backoff) is sufficient for the subscriber scale. Proactive tracking requires per-chat counters in KV with TTL, sliding window logic, and adds read/write overhead to every message send. Worth revisiting only if 429 errors become frequent at scale.

### 10. Web Dashboard

**Idea**: Replace the `/` health check with a status page showing subscriber count and recent webhook events.

**Decision**: Skip. The bot is the product, not a web app. A dashboard requires frontend code, event logging to KV, and maintenance for a feature only the operator would see. Cloudflare dashboard + Telegram already provide sufficient visibility.
