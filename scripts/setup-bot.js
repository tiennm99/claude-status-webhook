#!/usr/bin/env node

const TELEGRAM_API = "https://api.telegram.org/bot";

const BOT_COMMANDS = [
  { command: "help", description: "Detailed command guide" },
  { command: "start", description: "Subscribe to status notifications" },
  { command: "stop", description: "Unsubscribe from notifications" },
  { command: "status", description: "Current system status" },
  { command: "subscribe", description: "Set notification preferences" },
  { command: "history", description: "Recent incidents" },
  { command: "uptime", description: "Component health overview" },
];

async function main() {
  const token = process.env.BOT_TOKEN;
  const workerUrl = process.env.WORKER_URL;

  if (!token || !workerUrl) {
    console.error("Required env vars: BOT_TOKEN, WORKER_URL");
    console.error("Usage: BOT_TOKEN=xxx WORKER_URL=https://your-worker.workers.dev node scripts/setup-bot.js");
    process.exit(1);
  }

  // Set webhook
  const webhookRes = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${workerUrl}/webhook/telegram` }),
  });
  console.log("Webhook:", await webhookRes.json());

  // Register commands
  const commandsRes = await fetch(`${TELEGRAM_API}${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands: BOT_COMMANDS }),
  });
  console.log("Commands:", await commandsRes.json());
}

main().catch(console.error);
