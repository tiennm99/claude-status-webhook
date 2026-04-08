import { removeSubscriber } from "./kv-store.js";
import { telegramUrl } from "./telegram-api.js";
import { trackMetrics } from "./metrics.js";

/**
 * Process a batch of queued messages, sending each to Telegram.
 * Handles rate limits (429 → retry), blocked bots (403/400 → remove subscriber).
 */
export async function handleQueue(batch, env) {
  let sent = 0, failed = 0, retried = 0, removed = 0;

  for (const msg of batch.messages) {
    const { chatId, threadId, html } = msg.body;

    // Defensive check for malformed messages
    if (!chatId || !html) {
      console.error("Queue: malformed message, skipping", msg.body);
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
        console.log(`Queue: removing subscriber ${chatId}:${threadId} (HTTP ${res.status})`);
        await removeSubscriber(env.claude_status, chatId, threadId);
        removed++;
        msg.ack();
      } else if (res.status === 429) {
        console.log("Queue: rate limited, retrying");
        retried++;
        msg.retry();
      } else {
        console.error(`Queue: unexpected HTTP ${res.status} for ${chatId}`);
        failed++;
        msg.ack();
      }
    } catch (err) {
      console.error("Queue: network error, retrying", err);
      retried++;
      msg.retry();
    }
  }

  await trackMetrics(env.claude_status, {
    messagesSent: sent,
    messagesFailedPermanent: failed,
    messagesRetried: retried,
    subscribersRemoved: removed,
  });
}
