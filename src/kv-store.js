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
      chatId: Number(raw.slice(0, lastColon)),
      threadId: parseInt(possibleThread, 10),
    };
  }
  return { chatId: Number(raw), threadId: null };
}

/**
 * Build KV metadata object for subscriber filtering via list().
 * Stored as KV key metadata so getSubscribersByType() needs only list(), not get().
 */
function buildMetadata(types, components) {
  return { types, components };
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
 * Add or re-subscribe a user. Preserves existing types and components if already subscribed.
 */
export async function addSubscriber(kv, chatId, threadId, types = ["incident", "component"]) {
  const key = buildKvKey(chatId, threadId);
  const existing = await kv.get(key, "json");
  const value = {
    types: existing?.types || types,
    components: existing?.components || [],
  };
  await kv.put(key, JSON.stringify(value), {
    metadata: buildMetadata(value.types, value.components),
  });
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
  await kv.put(key, JSON.stringify(existing), {
    metadata: buildMetadata(existing.types, existing.components),
  });
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
  await kv.put(key, JSON.stringify(existing), {
    metadata: buildMetadata(existing.types, existing.components),
  });
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
 * Uses KV metadata from list() — O(1) list call, no individual get() needed.
 */
export async function getSubscribersByType(kv, eventType, componentName = null) {
  const keys = await listAllSubscriberKeys(kv);
  const results = [];

  for (const { name, metadata } of keys) {
    if (!metadata?.types?.includes(eventType)) continue;

    // Component-specific filtering
    if (eventType === "component" && componentName && metadata.components?.length > 0) {
      const match = metadata.components.some(
        (c) => c.toLowerCase() === componentName.toLowerCase()
      );
      if (!match) continue;
    }

    const { chatId, threadId } = parseKvKey(name);
    results.push({ chatId, threadId });
  }

  return results;
}
