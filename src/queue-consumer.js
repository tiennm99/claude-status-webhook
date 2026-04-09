/** @import { QueueMessage } from "./types.js" */

import { removeSubscriber } from "./kv-store.js";
import { telegramUrl } from "./telegram-api.js";
/**
 * Process a batch of queued messages, sending each to Telegram.
 * Handles rate limits (429 → retry), blocked bots (403/400 → remove subscriber).
 * @param {{ messages: Array<{ body: QueueMessage, ack: () => void, retry: () => void }> }} batch
 * @param {object} env
 */
export async function handleQueue(batch, env) {
  let sent = 0, failed = 0, retried = 0, removed = 0;

  for (const msg of batch.messages) {
    const { chatId, threadId, html } = msg.body;

    // Defensive check for malformed messages
    if (!chatId || !html) {
      console.error(JSON.stringify({ event: "queue_skip", reason: "malformed", body: msg.body }));
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
      if (threadId != null) payload.message_thread_id = threadId;

      const res = await fetch(telegramUrl(env.BOT_TOKEN, "sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        sent++;
        msg.ack();
      } else if (res.status === 403 || res.status === 400) {
        console.log(JSON.stringify({ event: "queue_remove", chatId, threadId, status: res.status }));
        await removeSubscriber(env.claude_status, chatId, threadId);
        removed++;
        msg.ack();
      } else if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        console.log(JSON.stringify({ event: "queue_ratelimit", chatId, retryAfter }));
        retried++;
        msg.retry();
      } else if (res.status >= 500) {
        console.error(JSON.stringify({ event: "queue_retry", chatId, status: res.status }));
        retried++;
        msg.retry();
      } else {
        console.error(JSON.stringify({ event: "queue_error", chatId, status: res.status }));
        failed++;
        msg.ack();
      }
    } catch (err) {
      console.error(JSON.stringify({ event: "queue_network_error", chatId, error: err.message }));
      retried++;
      msg.retry();
    }
  }

  if (sent || failed || retried || removed) {
    console.log(JSON.stringify({ event: "queue_batch", sent, failed, retried, removed }));
  }
}
