import { config } from "../config.js";

type Entry = { buf: Buffer; ct: string; expires: number };

const store = new Map<string, Entry>();

function trim(now: number): void {
  for (const [k, v] of store) {
    if (v.expires <= now) store.delete(k);
  }
  while (store.size > config.streamSegmentCacheMaxEntries) {
    const first = store.keys().next().value;
    if (first === undefined) break;
    store.delete(first);
  }
}

export function getStreamSegmentCacheStats(): {
  streamSegmentCacheEnabled: boolean;
  streamSegmentCacheEntries: number;
  streamSegmentCacheTtlMs: number;
  streamSegmentCacheMaxEntries: number;
  streamSegmentCacheMaxBytesPerSegment: number;
} {
  return {
    streamSegmentCacheEnabled: config.streamSegmentCacheEnabled,
    streamSegmentCacheEntries: store.size,
    streamSegmentCacheTtlMs: config.streamSegmentCacheTtlMs,
    streamSegmentCacheMaxEntries: config.streamSegmentCacheMaxEntries,
    streamSegmentCacheMaxBytesPerSegment: config.streamSegmentCacheMaxBytesPerSegment,
  };
}

export function getCachedSegment(target: string): Entry | null {
  if (!config.streamSegmentCacheEnabled) return null;
  const now = Date.now();
  const e = store.get(target);
  if (!e || e.expires <= now) {
    if (e) store.delete(target);
    return null;
  }
  return e;
}

export function setCachedSegment(target: string, buf: Buffer, ct: string): void {
  if (!config.streamSegmentCacheEnabled) return;
  if (buf.length > config.streamSegmentCacheMaxBytesPerSegment) return;
  const now = Date.now();
  store.set(target, { buf, ct: ct || "application/octet-stream", expires: now + config.streamSegmentCacheTtlMs });
  trim(now);
}
