import { Hono } from "hono";
import { handleTelegramWebhook } from "./bot-commands.js";
import { handleStatuspageWebhook } from "./statuspage-webhook.js";
import { handleQueue } from "./queue-consumer.js";
import { migrateFromSingleKey } from "./kv-store.js";
import { timingSafeEqual } from "./crypto-utils.js";

const app = new Hono();

// Normalize double slashes in URL path (e.g. //webhook/... → /webhook/...)
// Statuspage may send webhooks with double slashes; rewrite path so routes match.
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  const normalized = url.pathname.replace(/\/\/+/g, "/");
  if (normalized !== url.pathname) {
    url.pathname = normalized;
    const newReq = new Request(url.toString(), c.req.raw);
    return app.fetch(newReq, c.env, c.executionCtx);
  }
  return next();
});

app.get("/", (c) => c.text("Claude Status Bot is running"));
app.post("/webhook/telegram", (c) => handleTelegramWebhook(c));
app.post("/webhook/status/:secret", (c) => handleStatuspageWebhook(c));

// One-time migration route — remove after migration is confirmed
app.post("/migrate/:secret", async (c) => {
  const secret = c.req.param("secret");
  if (!await timingSafeEqual(secret, c.env.WEBHOOK_SECRET)) {
    return c.text("Unauthorized", 401);
  }
  const count = await migrateFromSingleKey(c.env.claude_status);
  return c.json({ migrated: count });
});

export default {
  fetch: app.fetch,
  queue: handleQueue,
};
