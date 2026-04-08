import { removeSubscriber } from "./kv-store.js";

const TELEGRAM_API = "https://api.telegram.org/bot";

/**
 * Process a batch of queued messages, sending each to Telegram.
 * Handles rate limits (429 → retry), blocked bots (403/400 → remove subscriber).
 */
export async function handleQueue(batch, env) {
  for (const msg of batch.messages) {
    const { chatId, threadId, html } = msg.body;

    // Defensive check for malformed messages
    if (!chatId || !html) {
      msg.ack();
      continue;
    }

    try {
      const payload = {
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      };
      // Send to specific supergroup topic if threadId present
      if (threadId) payload.message_thread_id = threadId;

      const res = await fetch(`${TELEGRAM_API}${env.BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        msg.ack();
      } else if (res.status === 403 || res.status === 400) {
        // Bot blocked or chat not found — auto-remove subscriber
        await removeSubscriber(env.SUBSCRIBERS, chatId, threadId);
        msg.ack();
      } else if (res.status === 429) {
        // Rate limited — let queue retry later
        msg.retry();
      } else {
        // Unknown error — ack to avoid infinite retry
        msg.ack();
      }
    } catch {
      // Network error — retry
      msg.retry();
    }
  }
}
