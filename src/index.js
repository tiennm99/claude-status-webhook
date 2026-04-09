import { Hono } from "hono";
import { handleTelegramWebhook } from "./bot-commands.js";
import { handleStatuspageWebhook } from "./statuspage-webhook.js";
import { handleQueue } from "./queue-consumer.js";

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


export default {
  fetch: app.fetch,
  queue: handleQueue,
};
