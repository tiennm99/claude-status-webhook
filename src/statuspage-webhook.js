import { getSubscribersByType } from "./kv-store.js";
import { humanizeStatus, escapeHtml } from "./status-fetcher.js";
import { timingSafeEqual } from "./crypto-utils.js";
import { notifyAdmin } from "./admin-notifier.js";

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
      const reason = "WEBHOOK_SECRET not configured";
      console.error(JSON.stringify({ event: "webhook_error", reason }));
      c.executionCtx.waitUntil(notifyAdmin(c.env, reason));
      return c.text("OK", 200);
    }

    const secret = c.req.param("secret");
    if (!await timingSafeEqual(secret, c.env.WEBHOOK_SECRET)) {
      const reason = "invalid_secret";
      console.error(JSON.stringify({ event: "webhook_error", reason }));
      c.executionCtx.waitUntil(notifyAdmin(c.env, reason));
      return c.text("OK", 200);
    }

    // Parse body
    let body;
    try {
      body = await c.req.json();
    } catch {
      const reason = "invalid_json";
      console.error(JSON.stringify({ event: "webhook_error", reason }));
      c.executionCtx.waitUntil(notifyAdmin(c.env, reason));
      return c.text("OK", 200);
    }

    const eventType = body?.meta?.event_type;
    if (!eventType) {
      const reason = "missing_event_type";
      const details = { keys: Object.keys(body || {}), meta: body?.meta ?? null };
      console.error(JSON.stringify({ level: "error", event: "webhook_error", reason, ...details }));
      c.executionCtx.waitUntil(notifyAdmin(c.env, reason, details));
      return c.text("OK", 200);
    }

    console.log(JSON.stringify({ event: "webhook_received", eventType }));

    // Determine category and format message
    let category, html, componentName;
    if (eventType.startsWith("incident.")) {
      if (!body.incident) {
        const reason = "missing_incident_data";
        console.error(JSON.stringify({ event: "webhook_error", reason, eventType }));
        c.executionCtx.waitUntil(notifyAdmin(c.env, reason, { eventType }));
        return c.text("OK", 200);
      }
      category = "incident";
      html = formatIncidentMessage(body.incident);
    } else if (eventType.startsWith("component.")) {
      if (!body.component) {
        const reason = "missing_component_data";
        console.error(JSON.stringify({ event: "webhook_error", reason, eventType }));
        c.executionCtx.waitUntil(notifyAdmin(c.env, reason, { eventType }));
        return c.text("OK", 200);
      }
      category = "component";
      componentName = body.component.name || null;
      html = formatComponentMessage(body.component, body.component_update);
    } else {
      const reason = "unknown_event_type";
      console.error(JSON.stringify({ event: "webhook_error", reason, eventType }));
      c.executionCtx.waitUntil(notifyAdmin(c.env, reason, { eventType }));
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
    const reason = "unexpected";
    console.error(JSON.stringify({ event: "webhook_error", reason, error: err.message }));
    c.executionCtx.waitUntil(notifyAdmin(c.env, reason, { error: err.message }));
    return c.text("OK", 200);
  }
}
