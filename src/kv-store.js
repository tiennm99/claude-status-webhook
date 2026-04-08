const KEY_PREFIX = "sub:";

/**
 * Build KV key: "sub:{chatId}" or "sub:{chatId}:{threadId}"
 */
function buildKvKey(chatId, threadId) {
  const suffix = threadId != null ? `${chatId}:${threadId}` : `${chatId}`;
  return `${KEY_PREFIX}${suffix}`;
}

/**
 * Parse KV key back into { chatId, threadId }
 * Key format: "sub:{chatId}" or "sub:{chatId}:{threadId}"
 */
function parseKvKey(kvKey) {
  const raw = kvKey.slice(KEY_PREFIX.length);
  const lastColon = raw.lastIndexOf(":");
  // No colon or only negative sign prefix — no threadId
  if (lastColon <= 0) {
    return { chatId: raw, threadId: null };
  }
  // Check if the part after last colon is a valid threadId (numeric)
  const possibleThread = raw.slice(lastColon + 1);
  if (/^\d+$/.test(possibleThread)) {
    return {
      chatId: raw.slice(0, lastColon),
      threadId: parseInt(possibleThread, 10),
    };
  }
  return { chatId: raw, threadId: null };
}

/**
 * List all subscriber KV keys with cursor pagination
 */
async function listAllSubscriberKeys(kv) {
  const keys = [];
  let cursor = undefined;
  do {
    const result = await kv.list({ prefix: KEY_PREFIX, cursor });
    keys.push(...result.keys);
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return keys;
}

/**
 * Add or re-subscribe a user with default types
 */
export async function addSubscriber(kv, chatId, threadId, types = ["incident", "component"]) {
  const key = buildKvKey(chatId, threadId);
  const existing = await kv.get(key, "json");
  const value = { types, components: existing?.components || [] };
  await kv.put(key, JSON.stringify(value));
}

/**
 * Remove subscriber — atomic single delete
 */
export async function removeSubscriber(kv, chatId, threadId) {
  const key = buildKvKey(chatId, threadId);
  await kv.delete(key);
}

/**
 * Update subscriber's notification type preferences
 */
export async function updateSubscriberTypes(kv, chatId, threadId, types) {
  const key = buildKvKey(chatId, threadId);
  const existing = await kv.get(key, "json");
  if (!existing) return false;
  existing.types = types;
  await kv.put(key, JSON.stringify(existing));
  return true;
}

/**
 * Update subscriber's component filter list
 */
export async function updateSubscriberComponents(kv, chatId, threadId, components) {
  const key = buildKvKey(chatId, threadId);
  const existing = await kv.get(key, "json");
  if (!existing) return false;
  existing.components = components;
  await kv.put(key, JSON.stringify(existing));
  return true;
}

/**
 * Get a single subscriber's data, or null if not subscribed
 */
export async function getSubscriber(kv, chatId, threadId) {
  const key = buildKvKey(chatId, threadId);
  return kv.get(key, "json");
}

/**
 * Get subscribers filtered by event type and optional component name.
 * Returns [{ chatId, threadId, ...value }, ...]
 */
export async function getSubscribersByType(kv, eventType, componentName = null) {
  const keys = await listAllSubscriberKeys(kv);
  const results = [];

  for (const { name } of keys) {
    const value = await kv.get(name, "json");
    if (!value || !value.types.includes(eventType)) continue;

    // Component-specific filtering
    if (eventType === "component" && componentName && value.components?.length > 0) {
      const match = value.components.some(
        (c) => c.toLowerCase() === componentName.toLowerCase()
      );
      if (!match) continue;
    }

    const { chatId, threadId } = parseKvKey(name);
    results.push({ chatId, threadId });
  }

  return results;
}

/**
 * Get all subscribers with their full data
 */
export async function getAllSubscribers(kv) {
  const keys = await listAllSubscriberKeys(kv);
  const results = [];
  for (const { name } of keys) {
    const value = await kv.get(name, "json");
    if (!value) continue;
    const { chatId, threadId } = parseKvKey(name);
    results.push({ chatId, threadId, ...value });
  }
  return results;
}

/**
 * One-time migration from single-key "subscribers" to per-key format.
 * Returns count of migrated entries.
 */
export async function migrateFromSingleKey(kv) {
  const old = await kv.get("subscribers", "json");
  if (!old) return 0;

  const entries = Object.entries(old);
  for (const [compositeKey, value] of entries) {
    // Preserve components field if it exists, default to empty
    const data = { types: value.types || [], components: value.components || [] };
    await kv.put(`${KEY_PREFIX}${compositeKey}`, JSON.stringify(data));
  }

  // Verify migrated count before deleting old key
  const migrated = await listAllSubscriberKeys(kv);
  if (migrated.length >= entries.length) {
    await kv.delete("subscribers");
    console.log(`Migration complete: ${entries.length} subscribers migrated`);
  } else {
    console.error(`Migration verification failed: expected ${entries.length}, got ${migrated.length}`);
  }

  return entries.length;
}
