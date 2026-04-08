import { Hono } from "hono";
import { handleTelegramWebhook } from "./bot-commands.js";
import { handleStatuspageWebhook } from "./statuspage-webhook.js";
import { handleQueue } from "./queue-consumer.js";
import { handleScheduled } from "./cron-status-check.js";
import { migrateFromSingleKey } from "./kv-store.js";

const app = new Hono();

app.get("/", (c) => c.text("Claude Status Bot is running"));
app.post("/webhook/telegram", (c) => handleTelegramWebhook(c));
app.post("/webhook/status/:secret", (c) => handleStatuspageWebhook(c));

// One-time migration route — remove after migration is confirmed
app.get("/migrate/:secret", async (c) => {
  const secret = c.req.param("secret");
  const encoder = new TextEncoder();
  const a = encoder.encode(secret);
  const b = encoder.encode(c.env.WEBHOOK_SECRET);
  if (a.byteLength !== b.byteLength || !crypto.subtle.timingSafeEqual(a, b)) {
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
