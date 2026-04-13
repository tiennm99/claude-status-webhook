import { telegramUrl } from "./telegram-api.js";

/**
 * Send an error notification to the admin via Telegram.
 * Silently fails — admin alerts must never break the main flow.
 * @param {object} env - Worker env bindings
 * @param {string} reason - Short error reason
 * @param {Record<string, unknown>} [details] - Extra context to include
 */
export async function notifyAdmin(env, reason, details = {}) {
  if (!env.ADMIN_CHAT_ID || !env.BOT_TOKEN) return;

  const text = [
    `<b>[Webhook Error]</b> ${reason}`,
    `<pre>${JSON.stringify(details, null, 2)}</pre>`,
  ].join("\n");

  try {
    await fetch(telegramUrl(env.BOT_TOKEN, "sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.ADMIN_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // Swallow — never let admin notification break the webhook
  }
}
