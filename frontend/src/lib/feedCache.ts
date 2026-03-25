/**
 * feedCache.ts
 * 以 localStorage 快取無限捲動列表的 items + recommId。
 *
 * key = pathname + search（穩定路由鍵），確保：
 * - PWA standalone 視窗重開後仍能命中快取
 * - iOS「加到主畫面」打開後仍能命中快取
 * （不使用 React Router location.key，因為它每次開新視窗都不同）
 *
 * TTL：10 分鐘；單條序列化後 > 800 KB 則略過（保護 localStorage 配額）。
 */

import type { RecommItem } from "../components/VideoCard";

const CACHE_PREFIX = "feed_cache_v2_";
const TTL_MS = 10 * 60 * 1000; // 10 分鐘
const MAX_BYTES = 800 * 1024; // 800 KB

export type FeedCacheEntry = {
  items: RecommItem[];
  recommId: string | null;
  ts: number;
};

/** pathname + search → 穩定的快取 key（跨視窗、跨 session 均一致） */
export function stableCacheKey(pathnameAndSearch: string): string {
  return `${CACHE_PREFIX}${pathnameAndSearch}`;
}

/** 讀取快取；若不存在或已過期則回傳 null */
export function readFeedCache(key: string): FeedCacheEntry | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as FeedCacheEntry;
    if (Date.now() - entry.ts > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

/** 寫入快取；序列化後超過 MAX_BYTES 則略過 */
export function writeFeedCache(
  key: string,
  data: Omit<FeedCacheEntry, "ts">
): void {
  try {
    const entry: FeedCacheEntry = { ...data, ts: Date.now() };
    const raw = JSON.stringify(entry);
    if (raw.length > MAX_BYTES) return;
    localStorage.setItem(key, raw);
  } catch {
    // localStorage 寫入失敗（私密模式配額滿）時靜默略過
  }
}

/** 清除指定 key 的快取（換語系等 resetKey 改變時呼叫） */
export function clearFeedCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
