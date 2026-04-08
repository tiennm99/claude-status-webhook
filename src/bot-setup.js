const TELEGRAM_API = "https://api.telegram.org/bot";

const BOT_COMMANDS = [
  { command: "start", description: "Subscribe to status notifications" },
  { command: "stop", description: "Unsubscribe from notifications" },
  { command: "status", description: "Check current Claude status" },
  { command: "subscribe", description: "Set notification preferences" },
];

/**
 * One-time setup: register bot commands and set Telegram webhook.
 * GET /webhook/setup/:secret
 */
export async function setupBot(c) {
  const secret = c.req.param("secret");
  if (secret !== c.env.WEBHOOK_SECRET) {
    return c.text("Unauthorized", 401);
  }

  const token = c.env.BOT_TOKEN;
  const workerUrl = new URL(c.req.url).origin;

  // Set webhook URL
  const webhookRes = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${workerUrl}/webhook/telegram` }),
  });
  const webhookData = await webhookRes.json();

  // Register bot commands
  const commandsRes = await fetch(`${TELEGRAM_API}${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands: BOT_COMMANDS }),
  });
  const commandsData = await commandsRes.json();

  return c.json({
    webhook: webhookData,
    commands: commandsData,
  });
}
