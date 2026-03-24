/**
 * hls-downloader.ts
 * 直接並行下載 HLS segments（即使副檔名為 .jpeg 實為 MPEG-TS）
 * 串接後用 ffmpeg remux 成 mp4。
 * 對應 Python base_api 的 threaded + _convert_ts_to_mp4 策略。
 */
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { config } from "../config.js";
import { buildCdnMediaHeaders } from "./missav-headers.js";
import { fetchVideoPage, parseVideoHtml } from "./missav-page.js";
import { upstreamFetch } from "./upstream-fetch.js";

const execFileAsync = promisify(execFile);

// ─── FFmpeg binary（優先使用捆綁舊版，可正確處理 .jpeg 偽 segment）──────────
let _ffmpegPath: string | null = null;
async function resolveFfmpegBinary(): Promise<string> {
  if (_ffmpegPath) return _ffmpegPath;
  // 優先用設定值
  if (config.ffmpegPath && config.ffmpegPath !== "ffmpeg") {
    _ffmpegPath = config.ffmpegPath;
    return _ffmpegPath;
  }
  // 嘗試捆綁的 @ffmpeg-installer（舊版，不會擋 .jpeg segment）
  try {
    await execFileAsync(ffmpegInstaller.path, ["-version"], { timeout: 5000 });
    _ffmpegPath = ffmpegInstaller.path;
    return _ffmpegPath;
  } catch { /* ignore */ }
  // fallback 系統 ffmpeg
  _ffmpegPath = "ffmpeg";
  return _ffmpegPath;
}

// ─── 解析 Master Playlist，選出目標 quality 的 sub-playlist URL ─────────────
type Variant = { bandwidth: number; height: number | null; url: string };

function parseAttributeMap(line: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of line.split(",")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    out.set(part.slice(0, idx).trim().toUpperCase(), part.slice(idx + 1).trim().replace(/^"|"$/g, ""));
  }
  return out;
}

function resolveUrl(base: string, raw: string): string {
  try { return new URL(raw, base).toString(); } catch { return raw; }
}

function parseMasterPlaylist(text: string, baseUrl: string): Variant[] {
  const lines = text.split(/\r?\n/);
  const variants: Variant[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const attrs = parseAttributeMap(line.slice("#EXT-X-STREAM-INF:".length));
    const next = lines[i + 1]?.trim() ?? "";
    if (!next || next.startsWith("#")) continue;
    const bw = Number.parseInt(attrs.get("BANDWIDTH") || "0", 10) || 0;
    const res = attrs.get("RESOLUTION") || "";
    const h = res.includes("x") ? (Number.parseInt(res.split("x")[1] || "", 10) || null) : null;
    variants.push({ bandwidth: bw, height: h, url: resolveUrl(baseUrl, next) });
  }
  return variants;
}

function pickVariant(variants: Variant[], quality: string): string {
  if (variants.length === 0) throw new Error("master playlist has no variants");
  const sorted = [...variants].sort((a, b) =>
    b.bandwidth !== a.bandwidth ? b.bandwidth - a.bandwidth : (b.height ?? 0) - (a.height ?? 0)
  );
  const q = quality.trim().toLowerCase();
  if (q === "worst" || q === "low") return sorted[sorted.length - 1]!.url;
  const h = Number.parseInt(q.replace(/p$/i, ""), 10);
  if (Number.isFinite(h) && h > 0) {
    const match = sorted.find((v) => (v.height ?? 0) <= h);
    if (match) return match.url;
  }
  return sorted[0]!.url;
}

// ─── 解析 sub-playlist 取出所有 segment 絕對 URL ────────────────────────────
function parseSegments(text: string, baseUrl: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => resolveUrl(baseUrl, l));
}

// ─── 並行下載 segments ────────────────────────────────────────────────────────
async function downloadSegment(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal
): Promise<Buffer> {
  const res = await upstreamFetch(url, { headers, signal });
  if (!res.ok) throw new Error(`segment HTTP ${res.status}: ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function downloadAllSegments(
  urls: string[],
  headers: Record<string, string>,
  concurrency: number,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<Buffer[]> {
  const results: (Buffer | null)[] = new Array(urls.length).fill(null);
  const abortSignal = signal ?? AbortSignal.timeout(60_000 * 60); // 1h max
  let idx = 0;
  let done = 0;
  const MAX_RETRY = 3;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= urls.length) return;
      let attempt = 0;
      while (attempt < MAX_RETRY) {
        try {
          results[i] = await downloadSegment(urls[i]!, headers, abortSignal);
          break;
        } catch (e) {
          attempt++;
          if (attempt >= MAX_RETRY) throw new Error(`segment ${i} 下載失敗（${MAX_RETRY} 次）: ${e instanceof Error ? e.message : e}`);
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
      done++;
      onProgress?.(done, urls.length);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
  await Promise.all(workers);
  return results as Buffer[];
}

// ─── ffmpeg remux：concat TS → mp4 ──────────────────────────────────────────
async function remuxTsToMp4(tsPath: string, mp4Path: string): Promise<void> {
  const ffmpeg = await resolveFfmpegBinary();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      ffmpeg,
      ["-nostdin", "-y", "-loglevel", "warning",
       "-i", tsPath,
       "-c", "copy",
       "-movflags", "+faststart",
       "-bsf:a", "aac_adtstoasc",
       mp4Path],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (c: string) => { stderr += c; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg remux 失敗 (exit ${code}): ${stderr.slice(-400)}`));
    });
  });
}

// ─── 主入口 ──────────────────────────────────────────────────────────────────
export type HlsDownloadResult = {
  ok: boolean;
  segmentCount: number;
  outputSizeBytes: bigint;
  error?: string;
};

export async function runHlsDownloadJob(payload: {
  pageUrl: string;
  outputPath: string;   // 最終 .mp4
  quality: string;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<HlsDownloadResult> {
  const concurrency = payload.concurrency ?? config.downloadQueueConcurrency * 8;

  // 1. 取得影片頁 → master playlist URL
  const parsed = parseVideoHtml(await fetchVideoPage(payload.pageUrl));
  const cdnHeaders = buildCdnMediaHeaders(payload.pageUrl, "media");

  // 2. 抓 master playlist
  const masterRes = await upstreamFetch(parsed.m3u8_base_url, {
    headers: cdnHeaders,
    signal: AbortSignal.timeout(30_000),
  });
  if (!masterRes.ok) throw new Error(`master playlist HTTP ${masterRes.status}`);
  const masterText = await masterRes.text();
  if (!masterText.includes("#EXTM3U")) throw new Error("master playlist 格式無效");

  // 3. 選品質，抓 sub-playlist
  const variants = parseMasterPlaylist(masterText, parsed.m3u8_base_url);
  const subUrl = variants.length > 0
    ? pickVariant(variants, payload.quality)
    : parsed.m3u8_base_url;

  const subRes = await upstreamFetch(subUrl, {
    headers: cdnHeaders,
    signal: AbortSignal.timeout(30_000),
  });
  if (!subRes.ok) throw new Error(`sub-playlist HTTP ${subRes.status}`);
  const subText = await subRes.text();

  // 4. 解析 segment 清單
  const segUrls = parseSegments(subText, subUrl);
  if (segUrls.length === 0) throw new Error("sub-playlist 沒有任何 segment");

  // 5. 並行下載所有 segment
  const buffers = await downloadAllSegments(
    segUrls,
    cdnHeaders,
    Math.max(4, Math.min(concurrency, 20)),
    payload.onProgress
  );

  // 6. 串接所有 segment → 暫存 .ts
  const tsPath = `${payload.outputPath}.ts`;
  const fd = await fs.open(tsPath, "w");
  for (const buf of buffers) {
    await fd.write(buf);
  }
  await fd.close();

  // 7. ffmpeg remux .ts → .mp4
  try {
    await remuxTsToMp4(tsPath, payload.outputPath);
  } finally {
    await fs.rm(tsPath, { force: true }).catch(() => undefined);
  }

  const stat = await fs.stat(payload.outputPath).catch(() => null);
  const size = BigInt(stat?.size ?? 0);
  const MIN = BigInt(256 * 1024);

  return {
    ok: (stat?.isFile() ?? false) && size >= MIN,
    segmentCount: segUrls.length,
    outputSizeBytes: size,
    error: (stat?.isFile() ?? false) && size >= MIN ? undefined : "輸出檔不存在或過小",
  };
}

export function getDownloadWorkerPoolStats(): {
  downloadWorkerPoolSize: number;
  downloadBackend: "hls-threaded";
} {
  return {
    downloadWorkerPoolSize: config.downloadQueueConcurrency,
    downloadBackend: "hls-threaded",
  };
}
