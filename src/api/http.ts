const UA = "SenaSetuAI/1.0 (delivery-confidence resupply; hackathon)";

const blockedUntil = new Map<string, number>();

export class FeedError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "FeedError";
    this.status = status;
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function isRateLimited(url: string) {
  return (blockedUntil.get(hostOf(url)) ?? 0) > Date.now();
}

export function markRateLimited(url: string, ms = 30 * 60 * 1000) {
  blockedUntil.set(hostOf(url), Date.now() + ms);
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  if (isRateLimited(url)) {
    throw new FeedError(`rate-limited (${hostOf(url)})`, 429);
  }
  const { timeoutMs = 8000, headers, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": UA,
        ...headers,
      },
    });
    if (res.status === 429) {
      markRateLimited(url);
      throw new FeedError(`429 ${hostOf(url)}`, 429);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new FeedError(`${res.status} ${res.statusText} ${body.slice(0, 180)}`.trim(), res.status);
    }
    const data = (await res.json()) as T & { error?: boolean; reason?: string; code?: string };
    if (data && typeof data === "object" && "error" in data && data.error) {
      const reason = String(data.reason ?? data.code ?? "upstream error");
      if (/limit|quota|exceed/i.test(reason)) markRateLimited(url);
      throw new FeedError(reason, 429);
    }
    return data as T;
  } catch (err) {
    if (err instanceof FeedError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new FeedError(`timeout after ${timeoutMs}ms`, 408);
    }
    throw new FeedError(err instanceof Error ? err.message : "fetch failed");
  } finally {
    clearTimeout(timer);
  }
}

export async function poolMap<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]!, i);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}
