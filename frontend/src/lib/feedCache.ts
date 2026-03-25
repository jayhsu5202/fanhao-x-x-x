/**
 * feedCache.ts
 * 以 localStorage 快取無限捲動列表的 items + recommId，
 * key = React Router location.key（每個歷史條目的唯一 ID）。
 *
 * 使用 localStorage 而非 sessionStorage，確保 PWA standalone 視窗
 * 或「加到主畫面」後開啟時快取仍然存在（sessionStorage 每次開新視窗會清空）。
 *
 * TTL：10 分鐘；單條序列化後 > 500 KB 則略過（保護 localStorage 配額）。
 */

import type { RecommItem } from "../components/VideoCard";

const CACHE_PREFIX = "feed_cache_";
const TTL_MS = 10 * 60 * 1000; // 10 分鐘
const MAX_BYTES = 500 * 1024; // 500 KB

export type FeedCacheEntry = {
  items: RecommItem[];
  recommId: string | null;
  ts: number;
};

function storageKey(locationKey: string): string {
  return `${CACHE_PREFIX}${locationKey}`;
}

/** 讀取快取；若不存在或已過期則回傳 null */
export function readFeedCache(locationKey: string): FeedCacheEntry | null {
  try {
    const raw = localStorage.getItem(storageKey(locationKey));
    if (!raw) return null;
    const entry = JSON.parse(raw) as FeedCacheEntry;
    if (Date.now() - entry.ts > TTL_MS) {
      localStorage.removeItem(storageKey(locationKey));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

/** 寫入快取；序列化後超過 MAX_BYTES 則略過 */
export function writeFeedCache(
  locationKey: string,
  data: Omit<FeedCacheEntry, "ts">
): void {
  try {
    const entry: FeedCacheEntry = { ...data, ts: Date.now() };
    const raw = JSON.stringify(entry);
    if (raw.length > MAX_BYTES) return;
    localStorage.setItem(storageKey(locationKey), raw);
  } catch {
    // localStorage 寫入失敗（私密模式配額滿）時靜默略過
  }
}

/** 清除指定 locationKey 的快取（換語系等 resetKey 改變時呼叫） */
export function clearFeedCache(locationKey: string): void {
  try {
    localStorage.removeItem(storageKey(locationKey));
  } catch {
    // ignore
  }
}
