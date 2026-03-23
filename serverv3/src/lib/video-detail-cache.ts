import { config } from "../config.js";
import type { ParsedVideoPage } from "./missav-page.js";

type Entry = { parsed: ParsedVideoPage; expires: number };

const cache = new Map<string, Entry>();

function trimCache(now: number): void {
  for (const [k, v] of cache) {
    if (v.expires <= now) cache.delete(k);
  }
  while (cache.size > config.videoPageParseCacheMaxEntries) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

export function getCachedVideoPageParsed(key: string): ParsedVideoPage | null {
  const now = Date.now();
  const hit = cache.get(key);
  if (!hit || hit.expires <= now) {
    if (hit) cache.delete(key);
    return null;
  }
  return hit.parsed;
}

export function setCachedVideoPageParsed(key: string, parsed: ParsedVideoPage): void {
  const t = Date.now();
  cache.set(key, { parsed, expires: t + config.videoPageParseCacheTtlMs });
  trimCache(t);
}
