import { config } from "../config.js";
import { parseThumbnailOnly } from "./missav-page.js";

/** 封面 URL 字串（解析 MissAV 頁後） */
type UrlEntry = { url: string; expires: number };

const urlCache = new Map<string, UrlEntry>();
const urlInFlight = new Map<string, Promise<string | null>>();

/** 圖片位元組 */
type ImgEntry = { buf: Buffer; ct: string; expires: number };

const imgStore = new Map<string, ImgEntry>();

function trimUrlCache(now: number): void {
  for (const [k, v] of urlCache) {
    if (v.expires <= now) urlCache.delete(k);
  }
  while (urlCache.size > config.thumbParseCacheMaxEntries) {
    const first = urlCache.keys().next().value;
    if (first === undefined) break;
    urlCache.delete(first);
  }
}

function trimImgStore(now: number): void {
  for (const [k, v] of imgStore) {
    if (v.expires <= now) imgStore.delete(k);
  }
  while (imgStore.size > config.thumbImageCacheMaxEntries) {
    const first = imgStore.keys().next().value;
    if (first === undefined) break;
    imgStore.delete(first);
  }
}

/**
 * 解析封面 CDN URL。僅依賴外層 `fetchVideoPage` 的佇列（`VIDEO_PAGE_FETCH_CONCURRENCY`），
 * 不再套第二層 PQueue，避免雙重排隊。
 */
export function resolveThumbnailUrlFromPage(
  cacheKey: string,
  fetchHtml: () => Promise<string>
): Promise<string | null> {
  const now = Date.now();
  const hit = urlCache.get(cacheKey);
  if (hit && hit.expires > now) return Promise.resolve(hit.url);

  const existing = urlInFlight.get(cacheKey);
  if (existing) return existing;

  const p = (async (): Promise<string | null> => {
    try {
      const html = await fetchHtml();
      const url = parseThumbnailOnly(html);
      if (url) {
        const t = Date.now();
        urlCache.set(cacheKey, { url, expires: t + config.thumbParseCacheTtlMs });
        trimUrlCache(t);
      }
      return url;
    } finally {
      urlInFlight.delete(cacheKey);
    }
  })();

  urlInFlight.set(cacheKey, p);
  return p;
}

export function primeThumbnailParseCache(cacheKey: string, thumbnailUrl: string): void {
  const t = Date.now();
  urlCache.set(cacheKey, { url: thumbnailUrl, expires: t + config.thumbParseCacheTtlMs });
  trimUrlCache(t);
}

export function getCachedThumbImage(cacheKey: string): ImgEntry | null {
  if (!config.thumbImageCacheEnabled) return null;
  const now = Date.now();
  const e = imgStore.get(cacheKey);
  if (!e || e.expires <= now) {
    if (e) imgStore.delete(cacheKey);
    return null;
  }
  return e;
}

export function setCachedThumbImage(cacheKey: string, buf: Buffer, ct: string): void {
  if (!config.thumbImageCacheEnabled) return;
  const now = Date.now();
  imgStore.set(cacheKey, { buf, ct: ct || "image/jpeg", expires: now + config.thumbImageCacheTtlMs });
  trimImgStore(now);
}

export function getThumbnailCacheStats(): {
  thumbParseCacheEntries: number;
  thumbImageCacheEnabled: boolean;
  thumbImageCacheEntries: number;
  thumbImageCacheTtlMs: number;
  thumbImageCacheMaxEntries: number;
} {
  return {
    thumbParseCacheEntries: urlCache.size,
    thumbImageCacheEnabled: config.thumbImageCacheEnabled,
    thumbImageCacheEntries: imgStore.size,
    thumbImageCacheTtlMs: config.thumbImageCacheTtlMs,
    thumbImageCacheMaxEntries: config.thumbImageCacheMaxEntries,
  };
}
