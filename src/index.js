import { Hono } from "hono";
import { handleTelegramWebhook } from "./bot-commands.js";
import { handleStatuspageWebhook } from "./statuspage-webhook.js";
import { handleQueue } from "./queue-consumer.js";
import { setupBot } from "./bot-setup.js";

const app = new Hono();

app.get("/", (c) => c.text("Claude Status Bot is running"));
app.get("/webhook/setup/:secret", (c) => setupBot(c));
app.post("/webhook/telegram", (c) => handleTelegramWebhook(c));
app.post("/webhook/status/:secret", (c) => handleStatuspageWebhook(c));

export default {
  fetch: app.fetch,
  queue: handleQueue,
};
