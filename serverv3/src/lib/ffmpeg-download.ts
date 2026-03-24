import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { config } from "../config.js";
import { buildCdnMediaHeaders } from "./missav-headers.js";
import { fetchVideoPage, parseVideoHtml } from "./missav-page.js";
import { upstreamFetch } from "./upstream-fetch.js";

const execFileAsync = promisify(execFile);
const FFMPEG_ERROR_TAIL_MAX = 1200;

export type FfmpegBinarySource = "configured" | "system" | "installer";

export type FfmpegResolution = {
  path: string;
  source: FfmpegBinarySource;
};

export type DownloadExecutionResult = {
  ok: boolean;
  exitCode: number | null;
  stderrTail: string;
  ffmpegSummary: string;
  outputExists: boolean;
  outputSizeBytes: bigint;
  ffmpegPath: string;
  ffmpegSource: FfmpegBinarySource;
  playlistUrl: string;
  error?: string;
};

let ffmpegResolutionPromise: Promise<FfmpegResolution> | null = null;

type Variant = {
  bandwidth: number;
  height: number | null;
  url: string;
};

function parseAttributeMap(line: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of line.split(",")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    out.set(part.slice(0, idx).trim().toUpperCase(), part.slice(idx + 1).trim().replace(/^"|"$/g, ""));
  }
  return out;
}

function resolveVariantUrl(baseUrl: string, raw: string): string {
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return raw;
  }
}

function parseMasterPlaylist(text: string, baseUrl: string): Variant[] {
  const lines = text.split(/\r?\n/);
  const variants: Variant[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const attrs = parseAttributeMap(line.slice("#EXT-X-STREAM-INF:".length));
    const nextLine = lines[i + 1]?.trim() ?? "";
    if (!nextLine || nextLine.startsWith("#")) continue;
    const bandwidth = Number.parseInt(attrs.get("BANDWIDTH") || "0", 10) || 0;
    const resolution = attrs.get("RESOLUTION") || "";
    const height = resolution.includes("x") ? Number.parseInt(resolution.split("x")[1] || "", 10) || null : null;
    variants.push({
      bandwidth,
      height,
      url: resolveVariantUrl(baseUrl, nextLine),
    });
  }
  return variants;
}

function pickVariant(variants: Variant[], quality: string): string {
  if (variants.length === 0) throw new Error("master playlist has no variants");
  const sorted = [...variants].sort((a, b) => {
    if (a.bandwidth !== b.bandwidth) return b.bandwidth - a.bandwidth;
    return (b.height ?? 0) - (a.height ?? 0);
  });
  const q = quality.trim().toLowerCase();
  if (q === "worst" || q === "low") return sorted[sorted.length - 1]!.url;
  const height = Number.parseInt(q.replace(/p$/i, ""), 10);
  if (Number.isFinite(height) && height > 0) {
    const match = sorted.find((v) => (v.height ?? 0) <= height);
    if (match) return match.url;
  }
  return sorted[0]!.url;
}

async function resolvePlaylistUrl(pageUrl: string, quality: string): Promise<string> {
  const parsed = parseVideoHtml(await fetchVideoPage(pageUrl));
  const res = await upstreamFetch(parsed.m3u8_base_url, {
    headers: buildCdnMediaHeaders(pageUrl, "media"),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`playlist upstream HTTP ${res.status}`);
  }
  const text = await res.text();
  if (!text.includes("#EXTM3U")) {
    throw new Error("playlist is not valid HLS");
  }
  const variants = parseMasterPlaylist(text, parsed.m3u8_base_url);
  return variants.length > 0 ? pickVariant(variants, quality) : parsed.m3u8_base_url;
}

function buildHeaderBlob(pageUrl: string): string {
  const headers = buildCdnMediaHeaders(pageUrl, "media");
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\r\n");
}

function summarizeFfmpegStderr(stderr: string, fallback: string): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const picked = lines.find((line) => /error|failed|invalid|unable|timed?\s*out|404|403/i.test(line)) ?? lines.at(-1) ?? fallback;
  return picked.length > 240 ? `${picked.slice(0, 240)}…` : picked;
}

async function probeFfmpegCandidate(pathValue: string, source: FfmpegBinarySource): Promise<FfmpegResolution | null> {
  try {
    await execFileAsync(pathValue, ["-version"], {
      timeout: 5_000,
      maxBuffer: 1024 * 128,
    });
    return { path: pathValue, source };
  } catch {
    return null;
  }
}

async function resolveFfmpegBinary(): Promise<FfmpegResolution> {
  if (ffmpegResolutionPromise) return ffmpegResolutionPromise;
  ffmpegResolutionPromise = (async () => {
    if (config.ffmpegPath !== "ffmpeg") {
      const configured = await probeFfmpegCandidate(config.ffmpegPath, "configured");
      if (configured) return configured;
      throw new Error(`configured ffmpeg not available: ${config.ffmpegPath}`);
    }
    const systemFfmpeg = await probeFfmpegCandidate("ffmpeg", "system");
    if (systemFfmpeg) return systemFfmpeg;
    const bundled = await probeFfmpegCandidate(ffmpegInstaller.path, "installer");
    if (bundled) return bundled;
    throw new Error("ffmpeg unavailable");
  })();
  return ffmpegResolutionPromise;
}

export async function checkFfmpegAvailable(): Promise<{ available: boolean; version: string | null; path: string | null; source: FfmpegBinarySource | null }> {
  try {
    const resolved = await resolveFfmpegBinary();
    const { stdout } = await execFileAsync(resolved.path, ["-version"], {
      timeout: 5_000,
      maxBuffer: 1024 * 128,
    });
    const firstLine = stdout.split(/\r?\n/).find(Boolean) ?? null;
    return { available: true, version: firstLine, path: resolved.path, source: resolved.source };
  } catch {
    return { available: false, version: null, path: null, source: null };
  }
}

export async function runDownloadJob(payload: {
  pageUrl: string;
  outputPath: string;
  quality: string;
}): Promise<DownloadExecutionResult> {
  const playlistUrl = await resolvePlaylistUrl(payload.pageUrl, payload.quality);
  const headers = buildHeaderBlob(payload.pageUrl);
  const ffmpeg = await resolveFfmpegBinary();

  return new Promise((resolve) => {
    const child = spawn(
      ffmpeg.path,
      [
        "-nostdin",
        "-y",
        "-loglevel",
        "warning",
        "-user_agent",
        buildCdnMediaHeaders(payload.pageUrl, "media")["User-Agent"] || "",
        "-headers",
        `${headers}\r\n`,
        "-protocol_whitelist",
        "file,http,https,tcp,tls,crypto",
        "-allowed_extensions",
        config.ffmpegHlsAllowedSegmentExtensions,
        "-i",
        playlistUrl,
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        payload.outputPath,
      ],
      {
        cwd: config.projectRoot,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
      if (stderr.length > FFMPEG_ERROR_TAIL_MAX * 2) {
        stderr = stderr.slice(-FFMPEG_ERROR_TAIL_MAX * 2);
      }
    });
    child.on("error", async (err) => {
      const summary = summarizeFfmpegStderr(stderr, err.message);
      const stat = await fs.stat(payload.outputPath).catch(() => null);
      resolve({
        ok: false,
        exitCode: null,
        stderrTail: stderr.trim().slice(-FFMPEG_ERROR_TAIL_MAX),
        ffmpegSummary: summary,
        outputExists: Boolean(stat?.isFile()),
        outputSizeBytes: BigInt(stat?.size ?? 0),
        ffmpegPath: ffmpeg.path,
        ffmpegSource: ffmpeg.source,
        playlistUrl,
        error: err.message,
      });
    });
    child.on("close", async (code) => {
      const stat = await fs.stat(payload.outputPath).catch(() => null);
      const stderrTail = stderr.trim().slice(-FFMPEG_ERROR_TAIL_MAX);
      const summary = summarizeFfmpegStderr(stderrTail, code === 0 ? "ffmpeg finished" : `ffmpeg exited with code ${code ?? "?"}`);
      resolve({
        ok: code === 0,
        exitCode: code,
        stderrTail,
        ffmpegSummary: summary,
        outputExists: Boolean(stat?.isFile()),
        outputSizeBytes: BigInt(stat?.size ?? 0),
        ffmpegPath: ffmpeg.path,
        ffmpegSource: ffmpeg.source,
        playlistUrl,
        error: code === 0 ? undefined : stderrTail || `ffmpeg exited with code ${code ?? "?"}`,
      });
    });
  });
}

export function getDownloadWorkerPoolStats(): {
  downloadWorkerPoolSize: number;
  downloadBackend: "ffmpeg";
} {
  return {
    downloadWorkerPoolSize: config.downloadQueueConcurrency,
    downloadBackend: "ffmpeg",
  };
}
