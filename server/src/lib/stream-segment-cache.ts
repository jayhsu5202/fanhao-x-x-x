import crypto from "node:crypto";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

export type StreamSegmentCacheStats = {
  streamSegmentCacheEnabled: boolean;
  streamSegmentCacheHits: number;
  streamSegmentCacheMisses: number;
  streamSegmentCacheEntries: number;
  streamSegmentCacheBytes: number;
};

type Entry = { buf: Buffer };

function hashKey(target: string): string {
  return crypto.createHash("sha256").update(target).digest("hex");
}

export function createStreamSegmentCache(opts: {
  enabled: boolean;
  maxEntries: number;
  maxTotalBytes: number;
  maxSegmentBytes: number;
}): {
  get(target: string): Buffer | undefined;
  put(target: string, buf: Buffer): void;
  drainTeeBranchToCache(stream: NodeWebReadableStream, target: string): void;
  getStats(): StreamSegmentCacheStats;
} {
  let hits = 0;
  let misses = 0;
  const map = new Map<string, Entry>();
  let totalBytes = 0;

  function evictOldest(): void {
    const first = map.keys().next().value as string | undefined;
    if (first === undefined) return;
    const e = map.get(first);
    if (e) totalBytes -= e.buf.length;
    map.delete(first);
  }

  function put(target: string, buf: Buffer): void {
    if (!opts.enabled || buf.length === 0 || buf.length > opts.maxSegmentBytes) return;
    const key = hashKey(target);
    const existing = map.get(key);
    if (existing) {
      map.delete(key);
      totalBytes -= existing.buf.length;
    }
    while (
      map.size >= opts.maxEntries ||
      (map.size > 0 && totalBytes + buf.length > opts.maxTotalBytes)
    ) {
      evictOldest();
    }
    if (totalBytes + buf.length > opts.maxTotalBytes) return;
    map.set(key, { buf });
    totalBytes += buf.length;
  }

  function get(target: string): Buffer | undefined {
    if (!opts.enabled) return undefined;
    const key = hashKey(target);
    const e = map.get(key);
    if (!e) {
      misses += 1;
      return undefined;
    }
    hits += 1;
    map.delete(key);
    map.set(key, e);
    return e.buf;
  }

  /**
   * 背景把 tee 的第二路收滿後寫入 LRU；不阻塞第一路吐給瀏覽器。
   * 超過單片上限則丟棄快取但仍把流讀完，避免 tee 背壓卡住上游。
   */
  function drainTeeBranchToCache(stream: NodeWebReadableStream, target: string): void {
    void (async () => {
      const reader = stream.getReader();
      try {
        if (!opts.enabled) {
          for (;;) {
            const { done } = await reader.read();
            if (done) break;
          }
          return;
        }
        const chunks: Buffer[] = [];
        let len = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.byteLength) continue;
          len += value.byteLength;
          if (len > opts.maxSegmentBytes) {
            chunks.length = 0;
            for (;;) {
              const r = await reader.read();
              if (r.done) break;
            }
            return;
          }
          chunks.push(Buffer.from(value));
        }
        if (chunks.length === 0) return;
        put(target, chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks));
      } catch {
        // ignore
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* noop */
        }
      }
    })();
  }

  function getStats(): StreamSegmentCacheStats {
    return {
      streamSegmentCacheEnabled: opts.enabled,
      streamSegmentCacheHits: hits,
      streamSegmentCacheMisses: misses,
      streamSegmentCacheEntries: map.size,
      streamSegmentCacheBytes: totalBytes,
    };
  }

  return { get, put, drainTeeBranchToCache, getStats };
}
