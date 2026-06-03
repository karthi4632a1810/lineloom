const cache = new Map();
const DEFAULT_TTL_MS = 45_000;

export const hisCacheKey = (parts = []) =>
  parts.map((part) => String(part ?? "").trim()).filter(Boolean).join(":");

export const getCachedHisQuery = async (key = "", ttlMs = DEFAULT_TTL_MS, loader = async () => null) => {
  if (!key) {
    return loader();
  }
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + Math.max(1000, Number(ttlMs) || DEFAULT_TTL_MS) });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      cache.delete(oldest);
    }
  }
  return value;
};
