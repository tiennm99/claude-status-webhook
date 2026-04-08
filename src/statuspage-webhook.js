import { getSubscribersByType } from "./kv-store.js";
import { humanizeStatus, escapeHtml } from "./status-fetcher.js";

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Verify Statuspage HMAC-SHA256 signature
 */
async function verifyHmacSignature(request, hmacKey) {
  if (!hmacKey) return false;
  const signature = request.headers.get("X-Statuspage-Signature");
  if (!signature) return false;

  const body = await request.clone().arrayBuffer();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hmacKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const sigBytes = hexToBytes(signature);
  return crypto.subtle.verify("HMAC", key, sigBytes, body);
}

/**
 * Timing-safe string comparison
 */
async function timingSafeEqual(a, b) {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  return crypto.subtle.timingSafeEqual(bufA, bufB);
}

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
  // Try HMAC verification first, fall back to URL secret
  const hmacValid = await verifyHmacSignature(c.req.raw, c.env.STATUSPAGE_HMAC_KEY);
  if (!hmacValid) {
    const secret = c.req.param("secret");
    if (!await timingSafeEqual(secret, c.env.WEBHOOK_SECRET)) {
      return c.text("Unauthorized", 401);
    }
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

  console.log(`Statuspage webhook: ${eventType}`);

  // Determine category and format message
  let category, html, componentName;
  if (eventType.startsWith("incident.")) {
    category = "incident";
    html = formatIncidentMessage(body.incident);
  } else if (eventType.startsWith("component.")) {
    category = "component";
    componentName = body.component?.name || null;
    html = formatComponentMessage(body.component, body.component_update);
  } else {
    return c.text("Unknown event type", 400);
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

  console.log(`Enqueued ${messages.length} messages for ${category}${componentName ? `:${componentName}` : ""}`);

  return c.text("OK", 200);
}
