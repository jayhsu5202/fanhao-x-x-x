import type Hls from "hls.js";

/**
 * 依 master 清單中「最高可選碼率」拉長目標緩衝。
 *
 * hls.js 有效前向緩衝秒數為：
 * `min(max(8 * maxBufferSize / levelBitrate, maxBufferLength), maxMaxBufferLength)`
 * （levelBitrate 為 bits/s，maxBufferSize 為 bytes）
 * 高碼率時若只加秒數、不加 **maxBufferSize**，會被 `8*maxBufferSize/bitrate` 卡住，
 * 看起來就像「怎麼調都不夠」。
 *
 * 直接改寫 `hls.config`（執行期會讀）。
 */
export function applyBitrateAwareBufferTargets(hls: Hls): void {
  const levels = hls.levels;
  if (!levels?.length) return;

  let maxBps = 0;
  for (const lvl of levels) {
    const b = Math.max(lvl.maxBitrate ?? 0, lvl.bitrate ?? 0, lvl.averageBitrate ?? 0);
    maxBps = Math.max(maxBps, b);
  }
  if (maxBps <= 0) return;

  const cfg = hls.config;

  /** 目標「至少」累積的前向秒數（與 maxBufferSize 公式對齊） */
  let targetSec = 180;
  /** 硬上限秒數（給願意緩很久／暫停預載） */
  let maxSec = 900;
  /** MSE 位元組上限：須滿足約 (desiredSec * maxBps / 8) 才有對應秒數 */
  let maxBytes = 200 * 1000 * 1000;

  if (maxBps >= 15_000_000) {
    targetSec = 360;
    maxSec = 1800;
    maxBytes = 950 * 1000 * 1000;
  } else if (maxBps >= 10_000_000) {
    targetSec = 300;
    maxSec = 1500;
    maxBytes = 720 * 1000 * 1000;
  } else if (maxBps >= 7_000_000) {
    targetSec = 260;
    maxSec = 1300;
    maxBytes = 520 * 1000 * 1000;
  } else if (maxBps >= 5_000_000) {
    targetSec = 220;
    maxSec = 1100;
    maxBytes = 400 * 1000 * 1000;
  }

  /** 依公式補足位元組下限，避免高碼率時「秒數設了卻達不到」 */
  const minBytesForTarget = Math.ceil((targetSec * maxBps) / 8);
  maxBytes = Math.max(maxBytes, minBytesForTarget);

  /** Chrome：`navigator.deviceMemory`（GB）低時略縮，降低 QuotaExceeded 風險 */
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number" && mem > 0 && mem <= 4) {
    maxBytes = Math.min(maxBytes, Math.floor(140 * 1000 * 1000));
    targetSec = Math.min(targetSec, 200);
    maxSec = Math.min(maxSec, 720);
  } else if (typeof mem === "number" && mem > 0 && mem <= 8) {
    maxBytes = Math.floor(maxBytes * 0.82);
    maxSec = Math.min(maxSec, 1200);
  }

  cfg.maxBufferLength = targetSec;
  cfg.maxMaxBufferLength = maxSec;
  cfg.maxBufferSize = maxBytes;
}
