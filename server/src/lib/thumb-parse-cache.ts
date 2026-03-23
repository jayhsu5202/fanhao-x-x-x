import PQueue from "p-queue";
import { config } from "../config.js";
import { parseThumbnailOnly } from "./missav-page.js";

type Entry = { url: string; expires: number };

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<string | null>>();

const htmlFetchQueue = new PQueue({ concurrency: config.thumbHtmlFetchConcurrency });

function trimCache(now: number): void {
  for (const [k, v] of cache) {
    if (v.expires <= now) cache.delete(k);
  }
  while (cache.size > config.thumbParseCacheMaxEntries) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

/**
 * 卡片 /preview 等會對每個 slug 打一次 MissAV 影片頁；合併同 key 進行中請求、TTL 快取解析出的封面 URL，
 * 並以佇列限制同時抓取 HTML 的數量（類似下載 multi-work），減少爆量與重複上游負載。
 */
export function resolveThumbnailUrlFromPage(
  cacheKey: string,
  fetchHtml: () => Promise<string>
): Promise<string | null> {
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > now) return Promise.resolve(hit.url);

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const p = (async (): Promise<string | null> => {
    try {
      return await htmlFetchQueue.add(
        async (): Promise<string | null> => {
          const html = await fetchHtml();
          const url = parseThumbnailOnly(html);
          if (url) {
            const t = Date.now();
            cache.set(cacheKey, { url, expires: t + config.thumbParseCacheTtlMs });
            trimCache(t);
          }
          return url;
        },
        { throwOnTimeout: true }
      );
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, p);
  return p;
}

export function getThumbHtmlQueueStats(): {
  thumbHtmlFetchConcurrency: number;
  thumbHtmlQueueSize: number;
  thumbHtmlQueuePending: number;
  thumbParseCacheEntries: number;
} {
  return {
    thumbHtmlFetchConcurrency: config.thumbHtmlFetchConcurrency,
    thumbHtmlQueueSize: htmlFetchQueue.size,
    thumbHtmlQueuePending: htmlFetchQueue.pending,
    thumbParseCacheEntries: cache.size,
  };
}
