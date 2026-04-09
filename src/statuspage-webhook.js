import { getSubscribersByType } from "./kv-store.js";
import { humanizeStatus, escapeHtml } from "./status-fetcher.js";
import { timingSafeEqual } from "./crypto-utils.js";

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
 * Handle incoming Statuspage webhook.
 * CRITICAL: Always return 200 — Statuspage removes subscriber webhooks on non-2xx responses.
 */
export async function handleStatuspageWebhook(c) {
  try {
    // Validate URL secret (timing-safe)
    // Guard against misconfigured deploy (undefined env var)
    if (!c.env.WEBHOOK_SECRET) {
      console.error(JSON.stringify({ event: "webhook_error", reason: "WEBHOOK_SECRET not configured" }));
      return c.text("OK", 200);
    }

    const secret = c.req.param("secret");
    if (!await timingSafeEqual(secret, c.env.WEBHOOK_SECRET)) {
      console.error(JSON.stringify({ event: "webhook_error", reason: "invalid_secret" }));
      return c.text("OK", 200);
    }

    // Parse body
    let body;
    try {
      body = await c.req.json();
    } catch {
      console.error(JSON.stringify({ event: "webhook_error", reason: "invalid_json" }));
      return c.text("OK", 200);
    }

    const eventType = body?.meta?.event_type;
    if (!eventType) {
      console.error(JSON.stringify({ event: "webhook_error", reason: "missing_event_type" }));
      return c.text("OK", 200);
    }

    console.log(JSON.stringify({ event: "webhook_received", eventType }));

    // Determine category and format message
    let category, html, componentName;
    if (eventType.startsWith("incident.")) {
      if (!body.incident) {
        console.error(JSON.stringify({ event: "webhook_error", reason: "missing_incident_data", eventType }));
        return c.text("OK", 200);
      }
      category = "incident";
      html = formatIncidentMessage(body.incident);
    } else if (eventType.startsWith("component.")) {
      if (!body.component) {
        console.error(JSON.stringify({ event: "webhook_error", reason: "missing_component_data", eventType }));
        return c.text("OK", 200);
      }
      category = "component";
      componentName = body.component.name || null;
      html = formatComponentMessage(body.component, body.component_update);
    } else {
      console.error(JSON.stringify({ event: "webhook_error", reason: "unknown_event_type", eventType }));
      return c.text("OK", 200);
    }

    // Get filtered subscribers (with component name filtering)
    const subscribers = await getSubscribersByType(c.env.claude_status, category, componentName);

    // Enqueue messages for fan-out via CF Queues (batch for performance)
    const messages = subscribers.map(({ chatId, threadId }) => ({
      body: { chatId, threadId, html },
    }));
    for (let i = 0; i < messages.length; i += 100) {
      await c.env["claude-status"].sendBatch(messages.slice(i, i + 100));
    }

    console.log(JSON.stringify({ event: "webhook_enqueued", category, componentName, count: messages.length }));
    return c.text("OK", 200);
  } catch (err) {
    // Catch-all: log error but still return 200 to prevent Statuspage from removing us
    console.error(JSON.stringify({ event: "webhook_error", reason: "unexpected", error: err.message }));
    return c.text("OK", 200);
  }
}
