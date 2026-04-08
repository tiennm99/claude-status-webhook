import { getSubscribersByType } from "./kv-store.js";
import { humanizeStatus, escapeHtml } from "./status-fetcher.js";

/**
 * Format incident event as Telegram HTML message
 */
function formatIncidentMessage(incident) {
  const impact = incident.impact?.toUpperCase() || "UNKNOWN";
  const latestUpdate = incident.incident_updates?.[0];

  let html = `<b>[${impact}] ${escapeHtml(incident.name)}</b>\n`;
  html += `Status: <code>${humanizeStatus(incident.status)}</code>\n`;
  if (latestUpdate?.body) {
    html += `\n${escapeHtml(latestUpdate.body)}\n`;
  }
  if (incident.shortlink) {
    html += `\n<a href="${incident.shortlink}">View details</a>`;
  }
  return html;
}

/**
 * Format component status change as Telegram HTML message
 */
function formatComponentMessage(component, update) {
  let html = `<b>Component Update: ${escapeHtml(component.name)}</b>\n`;
  if (update) {
    html += `${humanizeStatus(update.old_status)} → <b>${humanizeStatus(update.new_status)}</b>`;
  } else {
    html += `Status: <b>${humanizeStatus(component.status)}</b>`;
  }
  return html;
}

/**
 * Handle incoming Statuspage webhook
 */
export async function handleStatuspageWebhook(c) {
  // Validate secret (timing-safe comparison)
  const secret = c.req.param("secret");
  const encoder = new TextEncoder();
  const a = encoder.encode(secret);
  const b = encoder.encode(c.env.WEBHOOK_SECRET);
  if (a.byteLength !== b.byteLength || !crypto.subtle.timingSafeEqual(a, b)) {
    return c.text("Unauthorized", 401);
  }

  // Parse body
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.text("Bad Request", 400);
  }

  const eventType = body?.meta?.event_type;
  if (!eventType) return c.text("Bad Request", 400);

  // Determine category and format message
  let category, html;
  if (eventType.startsWith("incident.")) {
    category = "incident";
    html = formatIncidentMessage(body.incident);
  } else if (eventType.startsWith("component.")) {
    category = "component";
    html = formatComponentMessage(body.component, body.component_update);
  } else {
    return c.text("Unknown event type", 400);
  }

  // Get filtered subscribers
  const subscribers = await getSubscribersByType(c.env.claude_status, category);

  // Enqueue messages for fan-out via CF Queues (batch for performance)
  const messages = subscribers.map(({ chatId, threadId }) => ({
    body: { chatId, threadId, html },
  }));
  for (let i = 0; i < messages.length; i += 100) {
    await c.env["claude-status"].sendBatch(messages.slice(i, i + 100));
  }

  return c.text("OK", 200);
}
