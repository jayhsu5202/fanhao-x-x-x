import type { HlsConfig } from "hls.js";

/**
 * 經本站 `/api/stream` 雙跳代理時延遲與抖動較大：拉長目標緩衝、預取下一分片、
 * 放寬逾時與 ABR 飢餓容錯，減少卡頓與頻繁降碼。
 *
 * - 從最低碼率階起播（避免一開始就衝高碼率後 buffer 空窗）
 * - VoD EWMA 拉慢一點，減少碼率跳動
 * - capLevelToPlayerSize：小視窗不拉滿頻寬
 */
export const hlsConfigProxiedStream: Partial<HlsConfig> = {
  enableWorker: true,
  lowLatencyMode: false,
  capLevelToPlayerSize: true,
  /** 多數 master 清單為頻寬升序，0 ＝最低碼率起播、再慢慢升 */
  startLevel: 0,
  /** 基底值；實際會在 MANIFEST_PARSED 後依最高碼率覆寫（見 hlsBitrateBuffer） */
  maxBufferLength: 140,
  maxMaxBufferLength: 700,
  maxBufferSize: 120 * 1000 * 1000,
  backBufferLength: 120,
  startFragPrefetch: true,
  maxFragLookUpTolerance: 0.5,
  /** 雙跳代理時保守估頻寬，較少「衝高碼率後餓死」 */
  abrEwmaDefaultEstimate: 500_000,
  abrEwmaFastVoD: 5,
  abrEwmaSlowVoD: 18,
  abrBandWidthFactor: 0.92,
  abrBandWidthUpFactor: 0.45,
  maxBufferHole: 0.5,
  maxStarvationDelay: 16,
  maxLoadingDelay: 16,
  appendErrorMaxRetry: 6,
  fragLoadingTimeOut: 60_000,
  manifestLoadingTimeOut: 25_000,
  levelLoadingTimeOut: 25_000,
  fragLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: 25_000,
      maxLoadTimeMs: 180_000,
      timeoutRetry: {
        maxNumRetry: 5,
        retryDelayMs: 0,
        maxRetryDelayMs: 0,
      },
      errorRetry: {
        maxNumRetry: 8,
        retryDelayMs: 1000,
        maxRetryDelayMs: 8000,
      },
    },
  },
};
