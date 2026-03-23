import type { HlsConfig } from "hls.js";

/**
 * 經本站 `/api/stream` 雙跳代理時延遲與抖動較大：拉長目標緩衝、預取下一分片、
 * 放寬逾時與 ABR 飢餓容錯，減少卡頓與頻繁降碼。
 */
export const hlsConfigProxiedStream: Partial<HlsConfig> = {
  enableWorker: true,
  lowLatencyMode: false,
  maxBufferLength: 90,
  maxMaxBufferLength: 600,
  backBufferLength: 120,
  startFragPrefetch: true,
  /** 雙跳代理時保守估頻寬，較少「衝高碼率後餓死」 */
  abrEwmaDefaultEstimate: 800_000,
  abrBandWidthFactor: 0.92,
  abrBandWidthUpFactor: 0.55,
  maxBufferHole: 0.35,
  maxStarvationDelay: 12,
  maxLoadingDelay: 12,
  fragLoadingTimeOut: 45_000,
  manifestLoadingTimeOut: 25_000,
  levelLoadingTimeOut: 25_000,
};
