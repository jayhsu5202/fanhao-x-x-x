import type { HlsConfig } from "hls.js";

/**
 * 經本站 `/api/stream` 雙跳代理時延遲與抖動較大：拉長目標緩衝、預取下一分片、
 * 放寬逾時與 ABR 飢餓容錯，減少卡頓與頻繁降碼。
 */
export const hlsConfigProxiedStream: Partial<HlsConfig> = {
  enableWorker: true,
  lowLatencyMode: false,
  maxBufferLength: 60,
  maxMaxBufferLength: 600,
  backBufferLength: 120,
  startFragPrefetch: true,
  maxBufferHole: 0.35,
  maxStarvationDelay: 10,
  maxLoadingDelay: 10,
  fragLoadingTimeOut: 45_000,
  manifestLoadingTimeOut: 25_000,
  levelLoadingTimeOut: 25_000,
};
