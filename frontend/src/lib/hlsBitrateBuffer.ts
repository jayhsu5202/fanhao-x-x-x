import type Hls from "hls.js";

/**
 * 依 master 清單中「最高可選碼率」拉長目標緩衝：高流碼需要更多秒數與位元組上限，
 * 否則雙跳代理下容易 buffer 追不上。
 *
 * 直接改寫 `hls.config`（hls.js 執行期會讀這些欄位）。
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

  /** 秒：目標前向緩衝；高碼率階梯加長 */
  let targetSec = 140;
  let maxSec = 650;
  /** 位元組：避免 MSE 無上限；約 = 數秒 × 最高碼率 × 安全係數 */
  let maxBytes = 120 * 1000 * 1000;

  if (maxBps >= 15_000_000) {
    targetSec = 260;
    maxSec = 960;
    maxBytes = 320 * 1000 * 1000;
  } else if (maxBps >= 10_000_000) {
    targetSec = 220;
    maxSec = 880;
    maxBytes = 260 * 1000 * 1000;
  } else if (maxBps >= 7_000_000) {
    targetSec = 190;
    maxSec = 780;
    maxBytes = 200 * 1000 * 1000;
  } else if (maxBps >= 5_000_000) {
    targetSec = 170;
    maxSec = 720;
    maxBytes = 160 * 1000 * 1000;
  }

  /** Chrome：`navigator.deviceMemory` 為 GB 級概略值，低記憶體裝置略縮位元組上限 */
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number" && mem > 0 && mem <= 4) {
    maxBytes = Math.min(maxBytes, Math.floor(90 * 1000 * 1000));
    targetSec = Math.min(targetSec, 160);
    maxSec = Math.min(maxSec, 600);
  } else if (typeof mem === "number" && mem > 0 && mem <= 8) {
    maxBytes = Math.floor(maxBytes * 0.85);
  }

  cfg.maxBufferLength = targetSec;
  cfg.maxMaxBufferLength = maxSec;
  cfg.maxBufferSize = maxBytes;
}
