const KV_KEY = "claude-status:subscribers";

/**
 * Build composite key: "chatId" or "chatId:threadId" for supergroup topics
 */
export function buildSubscriberKey(chatId, threadId) {
  return threadId != null ? `${chatId}:${threadId}` : `${chatId}`;
}

/**
 * Parse composite key back into { chatId, threadId }
 */
export function parseSubscriberKey(key) {
  const parts = key.split(":");
  if (parts.length >= 2 && parts[0].startsWith("-")) {
    // Supergroup IDs start with "-100", so key is "-100xxx:threadId"
    // Find the last ":" — everything before is chatId, after is threadId
    const lastColon = key.lastIndexOf(":");
    return {
      chatId: key.slice(0, lastColon),
      threadId: parseInt(key.slice(lastColon + 1), 10),
    };
  }
  return { chatId: key, threadId: null };
}

/**
 * Get all subscribers from KV
 */
export async function getSubscribers(kv) {
  const data = await kv.get(KV_KEY, "json");
  return data || {};
}

/**
 * Write all subscribers to KV
 */
async function setSubscribers(kv, data) {
  await kv.put(KV_KEY, JSON.stringify(data));
}

/**
 * Add subscriber with default types
 */
export async function addSubscriber(kv, chatId, threadId, types = ["incident", "component"]) {
  const subs = await getSubscribers(kv);
  const key = buildSubscriberKey(chatId, threadId);
  subs[key] = { types };
  await setSubscribers(kv, subs);
}

/**
 * Remove subscriber
 */
export async function removeSubscriber(kv, chatId, threadId) {
  const subs = await getSubscribers(kv);
  const key = buildSubscriberKey(chatId, threadId);
  delete subs[key];
  await setSubscribers(kv, subs);
}

/**
 * Update subscriber's notification type preferences
 */
export async function updateSubscriberTypes(kv, chatId, threadId, types) {
  const subs = await getSubscribers(kv);
  const key = buildSubscriberKey(chatId, threadId);
  if (!subs[key]) {
    subs[key] = { types };
  } else {
    subs[key].types = types;
  }
  await setSubscribers(kv, subs);
}

/**
 * Get subscribers filtered by event type, returns [{ chatId, threadId }, ...]
 */
export async function getSubscribersByType(kv, eventType) {
  const subs = await getSubscribers(kv);
  return Object.entries(subs)
    .filter(([, val]) => val.types.includes(eventType))
    .map(([key]) => parseSubscriberKey(key));
}
