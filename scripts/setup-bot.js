#!/usr/bin/env node

import { createInterface } from "node:readline/promises";

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

async function prompt(rl, question) {
  const answer = (await rl.question(question)).trim();
  if (!answer) {
    console.error("Input required. Aborting.");
    process.exit(1);
  }
  return answer;
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const token = await prompt(rl, "Bot token: ");
    const workerUrl = await prompt(rl, "Worker URL (e.g. https://your-worker.workers.dev): ");

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
  } finally {
    rl.close();
  }
}

main().catch(console.error);
