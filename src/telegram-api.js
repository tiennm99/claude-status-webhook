/**
 * Shared Telegram Bot API base URL and helper
 */
export const TELEGRAM_API = "https://api.telegram.org/bot";

export function telegramUrl(token, method) {
  return `${TELEGRAM_API}${token}/${method}`;
}
