const METRICS_KEY = "metrics";

const DEFAULT_METRICS = {
  webhooksReceived: 0,
  messagesEnqueued: 0,
  messagesSent: 0,
  messagesFailedPermanent: 0,
  messagesRetried: 0,
  subscribersRemoved: 0,
  cronChecks: 0,
  cronChangesDetected: 0,
  commandsProcessed: 0,
  lastWebhookAt: null,
  lastCronAt: null,
  startedAt: new Date().toISOString(),
};

/**
 * Get current metrics from KV
 */
export async function getMetrics(kv) {
  const data = await kv.get(METRICS_KEY, "json");
  return data || { ...DEFAULT_METRICS };
}

/**
 * Increment one or more metric counters and optionally set timestamp fields
 */
export async function trackMetrics(kv, updates) {
  const metrics = await getMetrics(kv);
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === "number") {
      metrics[key] = (metrics[key] || 0) + value;
    } else {
      metrics[key] = value;
    }
  }
  await kv.put(METRICS_KEY, JSON.stringify(metrics));
}

/**
 * Format metrics as HTML for Telegram or plain text for API
 */
export function formatMetricsText(metrics) {
  const uptime = metrics.startedAt
    ? timeSince(new Date(metrics.startedAt))
    : "unknown";

  return [
    `Webhooks received: ${metrics.webhooksReceived}`,
    `Messages enqueued: ${metrics.messagesEnqueued}`,
    `Messages sent: ${metrics.messagesSent}`,
    `Messages failed: ${metrics.messagesFailedPermanent}`,
    `Messages retried: ${metrics.messagesRetried}`,
    `Subscribers auto-removed: ${metrics.subscribersRemoved}`,
    `Cron checks: ${metrics.cronChecks}`,
    `Cron changes detected: ${metrics.cronChangesDetected}`,
    `Commands processed: ${metrics.commandsProcessed}`,
    `Last webhook: ${metrics.lastWebhookAt || "never"}`,
    `Last cron: ${metrics.lastCronAt || "never"}`,
    `Tracking since: ${uptime}`,
  ].join("\n");
}

/**
 * Human-readable time duration since a given date
 */
function timeSince(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}
