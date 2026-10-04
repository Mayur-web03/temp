type Entry<T> = { exp: number; value: T };

const mem = new Map<string, Entry<unknown>>();
const LS_PREFIX = "senasetu.feed.";

function lsRead(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(LS_PREFIX + key);
  } catch {
    return null;
  }
}

function lsWrite(key: string, raw: string) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(LS_PREFIX + key, raw);
  } catch {
    /* quota */
  }
}

export function cacheGet<T>(key: string): T | null {
  const hit = mem.get(key);
  if (hit && hit.exp > Date.now()) return hit.value as T;
  if (hit) mem.delete(key);
  const raw = lsRead(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Entry<T>;
    if (parsed.exp > Date.now()) {
      mem.set(key, parsed);
      return parsed.value;
    }
  } catch {
    return null;
  }
  return null;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  const entry: Entry<T> = { exp: Date.now() + ttlMs, value };
  mem.set(key, entry);
  lsWrite(key, JSON.stringify(entry));
}

export const TTL = {
  weather: 15 * 60 * 1000,
  historical: 12 * 60 * 60 * 1000,
  elevation: 7 * 24 * 60 * 60 * 1000,
  route: 24 * 60 * 60 * 1000,
  osm: 24 * 60 * 60 * 1000,
  geocode: 7 * 24 * 60 * 60 * 1000,
} as const;
