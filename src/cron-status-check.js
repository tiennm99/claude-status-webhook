import { fetchSummary, humanizeStatus, escapeHtml } from "./status-fetcher.js";
import { getSubscribersByType } from "./kv-store.js";
import { trackMetrics } from "./metrics.js";

const LAST_STATUS_KEY = "last-status";

/**
 * Build a map of component name -> status from summary
 */
function buildStatusMap(summary) {
  const map = {};
  for (const c of summary.components) {
    if (!c.group) map[c.name] = c.status;
  }
  return map;
}

/**
 * Format a component status change detected by cron
 */
function formatChangeMessage(name, oldStatus, newStatus) {
  return (
    `<b>Component Update: ${escapeHtml(name)}</b>\n` +
    `${humanizeStatus(oldStatus)} → <b>${humanizeStatus(newStatus)}</b>\n` +
    `<i>(detected by status check)</i>`
  );
}

/**
 * CF Scheduled handler — polls status page, notifies on changes
 */
export async function handleScheduled(env) {
  const kv = env.claude_status;
  const queue = env["claude-status"];

  let summary;
  try {
    summary = await fetchSummary();
  } catch (err) {
    console.error("Cron: failed to fetch status:", err);
    return;
  }

  const currentMap = buildStatusMap(summary);
  const stored = await kv.get(LAST_STATUS_KEY, "json");
  const previousMap = stored?.components || {};

  // Find changes (only if previous state exists for that component)
  const changes = [];
  for (const [name, status] of Object.entries(currentMap)) {
    if (previousMap[name] && previousMap[name] !== status) {
      changes.push({ name, oldStatus: previousMap[name], newStatus: status });
    }
  }

  // Always update stored state (proves cron is running)
  await kv.put(LAST_STATUS_KEY, JSON.stringify({
    components: currentMap,
    timestamp: new Date().toISOString(),
  }));

  await trackMetrics(kv, {
    cronChecks: 1,
    lastCronAt: new Date().toISOString(),
  });

  if (changes.length === 0) return;

  console.log(`Cron: ${changes.length} component change(s) detected`);

  // Enqueue notifications for each change
  for (const { name, oldStatus, newStatus } of changes) {
    const html = formatChangeMessage(name, oldStatus, newStatus);
    const subscribers = await getSubscribersByType(kv, "component", name);
    const messages = subscribers.map(({ chatId, threadId }) => ({
      body: { chatId, threadId, html },
    }));
    for (let i = 0; i < messages.length; i += 100) {
      await queue.sendBatch(messages.slice(i, i + 100));
    }
    console.log(`Cron: enqueued ${messages.length} messages for ${name} change`);
  }

  await trackMetrics(kv, { cronChangesDetected: changes.length });
}
