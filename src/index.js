import { Hono } from "hono";
import { handleTelegramWebhook } from "./bot-commands.js";
import { handleStatuspageWebhook } from "./statuspage-webhook.js";
import { handleQueue } from "./queue-consumer.js";

const app = new Hono();

app.get("/", (c) => c.text("Claude Status Bot is running"));
app.post("/webhook/telegram", (c) => handleTelegramWebhook(c));
app.post("/webhook/status/:secret", (c) => handleStatuspageWebhook(c));

export default {
  fetch: app.fetch,
  queue: handleQueue,
};
