import { Bot, webhookCallback } from "grammy";
import {
  addSubscriber,
  removeSubscriber,
  updateSubscriberTypes,
  getSubscribers,
  buildSubscriberKey,
} from "./kv-store.js";
import { registerInfoCommands } from "./bot-info-commands.js";

/**
 * Extract chatId and threadId from grammY context
 */
function getChatTarget(ctx) {
  return {
    chatId: ctx.chat.id,
    threadId: ctx.message?.message_thread_id ?? null,
  };
}

/**
 * Handle incoming Telegram webhook via grammY
 */
export async function handleTelegramWebhook(c) {
  const bot = new Bot(c.env.BOT_TOKEN);
  const kv = c.env.claude_status;

  bot.command("start", async (ctx) => {
    const { chatId, threadId } = getChatTarget(ctx);
    await addSubscriber(kv, chatId, threadId);
    await ctx.reply(
      "Subscribed to Claude status updates (incidents + components).\n" +
        "Use /subscribe to change preferences.\n" +
        "Use /stop to unsubscribe.",
      { parse_mode: "HTML" }
    );
  });

  bot.command("stop", async (ctx) => {
    const { chatId, threadId } = getChatTarget(ctx);
    await removeSubscriber(kv, chatId, threadId);
    await ctx.reply("Unsubscribed from Claude status updates. Use /start to resubscribe.", {
      parse_mode: "HTML",
    });
  });

  bot.command("subscribe", async (ctx) => {
    const { chatId, threadId } = getChatTarget(ctx);
    const arg = ctx.match?.trim().toLowerCase();

    const validTypes = {
      incident: ["incident"],
      component: ["component"],
      all: ["incident", "component"],
    };

    if (!arg || !validTypes[arg]) {
      const key = buildSubscriberKey(chatId, threadId);
      const subs = await getSubscribers(kv);
      const current = subs[key]?.types?.join(", ") || "none (use /start first)";
      await ctx.reply(
        "<b>Usage:</b> /subscribe &lt;type&gt;\n\n" +
          "Types: <code>incident</code>, <code>component</code>, <code>all</code>\n" +
          `\nCurrent: <code>${current}</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    await updateSubscriberTypes(kv, chatId, threadId, validTypes[arg]);
    await ctx.reply(`Subscription updated: <code>${validTypes[arg].join(", ")}</code>`, {
      parse_mode: "HTML",
    });
  });

  // Info commands: /help, /status, /history, /uptime
  registerInfoCommands(bot);

  bot.on("message", async (ctx) => {
    await ctx.reply(
      "<b>Claude Status Bot</b>\n\n" +
        "/help — Detailed command guide\n" +
        "/start — Subscribe to notifications\n" +
        "/stop — Unsubscribe\n" +
        "/status — Current system status\n" +
        "/subscribe — Notification preferences\n" +
        "/history — Recent incidents\n" +
        "/uptime — Component health overview",
      { parse_mode: "HTML" }
    );
  });

  const handler = webhookCallback(bot, "cloudflare-mod");
  return handler(c.req.raw);
}
