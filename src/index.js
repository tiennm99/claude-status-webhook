import { Hono } from "hono";
import { handleTelegramWebhook } from "./bot-commands.js";
import { handleStatuspageWebhook } from "./statuspage-webhook.js";
import { handleQueue } from "./queue-consumer.js";
import { handleScheduled } from "./cron-status-check.js";
import { migrateFromSingleKey } from "./kv-store.js";
import { getMetrics, formatMetricsText } from "./metrics.js";

const app = new Hono();

/**
 * Timing-safe secret validation helper
 */
async function validateSecret(secret, expected) {
  const encoder = new TextEncoder();
  const a = encoder.encode(secret);
  const b = encoder.encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

app.get("/", (c) => c.text("Claude Status Bot is running"));
app.post("/webhook/telegram", (c) => handleTelegramWebhook(c));
app.post("/webhook/status/:secret", (c) => handleStatuspageWebhook(c));

// Metrics endpoint — view bot statistics
app.get("/metrics/:secret", async (c) => {
  const secret = c.req.param("secret");
  if (!await validateSecret(secret, c.env.WEBHOOK_SECRET)) {
    return c.text("Unauthorized", 401);
  }
  const metrics = await getMetrics(c.env.claude_status);
  const format = c.req.query("format");
  if (format === "json") return c.json(metrics);
  return c.text(formatMetricsText(metrics));
});

// One-time migration route — remove after migration is confirmed
app.get("/migrate/:secret", async (c) => {
  const secret = c.req.param("secret");
  if (!await validateSecret(secret, c.env.WEBHOOK_SECRET)) {
    return c.text("Unauthorized", 401);
  }
  const count = await migrateFromSingleKey(c.env.claude_status);
  return c.json({ migrated: count });
});

export default {
  fetch: app.fetch,
  queue: handleQueue,
  scheduled: (event, env, ctx) => ctx.waitUntil(handleScheduled(env)),
};
