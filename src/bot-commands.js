/** @import { ChatTarget } from "./types.js" */

import { Bot, webhookCallback } from "grammy";
import {
  addSubscriber,
  removeSubscriber,
  updateSubscriberTypes,
  updateSubscriberComponents,
  getSubscriber,
} from "./kv-store.js";
import { fetchComponentByName, escapeHtml } from "./status-fetcher.js";
import { registerInfoCommands } from "./bot-info-commands.js";

/**
 * Module-level KV reference, updated each request.
 * Safe because CF Workers are single-threaded per isolate.
 */
let kv = null;

/**
 * Extract chatId and threadId from grammY context
 * @returns {ChatTarget}
 */
function getChatTarget(ctx) {
  return {
    chatId: ctx.chat.id,
    threadId: ctx.message?.message_thread_id ?? null,
  };
}

/**
 * Create Bot with all commands registered. Called once per isolate.
 */
function createBot(token) {
  const bot = new Bot(token);

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
    const args = ctx.match?.trim().toLowerCase().split(/\s+/) || [];
    const arg = args[0];

    // Handle "/subscribe component <name>" or "/subscribe component all"
    if (arg === "component" && args.length > 1) {
      const componentArg = args.slice(1).join(" ");
      const sub = await getSubscriber(kv, chatId, threadId);
      if (!sub) {
        await ctx.reply("Not subscribed yet. Use /start first.", { parse_mode: "HTML" });
        return;
      }
      if (componentArg === "all") {
        await updateSubscriberComponents(kv, chatId, threadId, []);
        await ctx.reply("Component filter cleared — receiving all component updates.", {
          parse_mode: "HTML",
        });
        return;
      }
      // Validate component name against live API
      const component = await fetchComponentByName(componentArg);
      if (!component) {
        await ctx.reply(`Component "<code>${escapeHtml(componentArg)}</code>" not found.`, {
          parse_mode: "HTML",
        });
        return;
      }
      // Add to component filter (deduplicate)
      const components = sub.components || [];
      if (!components.some((c) => c.toLowerCase() === component.name.toLowerCase())) {
        components.push(component.name);
      }
      await updateSubscriberComponents(kv, chatId, threadId, components);
      // Ensure "component" is in types
      if (!sub.types.includes("component")) {
        sub.types.push("component");
        await updateSubscriberTypes(kv, chatId, threadId, sub.types);
      }
      await ctx.reply(
        `Subscribed to component: <code>${escapeHtml(component.name)}</code>\n` +
          `Active filters: <code>${components.join(", ")}</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const validTypes = {
      incident: ["incident"],
      component: ["component"],
      all: ["incident", "component"],
    };

    if (!arg || !validTypes[arg]) {
      const sub = await getSubscriber(kv, chatId, threadId);
      const current = sub?.types?.join(", ") || "none (use /start first)";
      const compFilter = sub?.components?.length ? sub.components.join(", ") : "all";
      await ctx.reply(
        "<b>Usage:</b> /subscribe &lt;type&gt; [component]\n\n" +
          "Types: <code>incident</code>, <code>component</code>, <code>all</code>\n" +
          "Component filter: <code>/subscribe component api</code>\n" +
          "Clear filter: <code>/subscribe component all</code>\n" +
          `\nCurrent types: <code>${current}</code>\n` +
          `Components: <code>${compFilter}</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const updated = await updateSubscriberTypes(kv, chatId, threadId, validTypes[arg]);
    if (!updated) {
      await ctx.reply("Not subscribed yet. Use /start first.", { parse_mode: "HTML" });
      return;
    }
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

  return bot;
}

/**
 * Cached Bot instance — avoids rebuilding middleware chain on every request.
 * CF Workers reuse isolates, so module-level state persists across requests.
 */
let cachedBot = null;
let cachedToken = null;
let cachedHandler = null;

/**
 * Handle incoming Telegram webhook via grammY
 */
export async function handleTelegramWebhook(c) {
  // Update module-level KV ref (same binding across requests, but kept explicit)
  kv = c.env.claude_status;

  if (!cachedBot || cachedToken !== c.env.BOT_TOKEN) {
    cachedBot = createBot(c.env.BOT_TOKEN);
    cachedToken = c.env.BOT_TOKEN;
    cachedHandler = webhookCallback(cachedBot, "cloudflare-mod");
  }

  return cachedHandler(c.req.raw);
}
