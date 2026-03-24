import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildMissavDocumentHeaders, buildCdnMediaHeaders, parseVideoHtml } from "./missav-page.js";
import { upstreamFetch } from "./upstream-fetch.js";

const execFileAsync = promisify(execFile);

type Variant = {
  url: string;
  bandwidth: number;
  width: number;
  height: number;
  label: string | null;
};

function summarizeErr(text: string, maxLen = 500): string {
  const first = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const t = first ?? text.trim();
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

function absoluteUrl(base: string, ref: string): string {
  return new URL(ref, base).href;
}

async function fetchText(url: string, headers: Record<string, string>): Promise<string> {
  const res = await upstreamFetch(url, {
    headers,
    signal: AbortSignal.timeout(25_000),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`上游請求失敗 (${res.status})`);
  }
  return res.text();
}

function parseMasterPlaylist(body: string, playlistUrl: string): Variant[] {
  const lines = body.split(/\r?\n/);
  const variants: Variant[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line.startsWith("#EXT-X-STREAM-INF:")) continue;
    const attrs = line.slice("#EXT-X-STREAM-INF:".length);
    const next = lines.slice(i + 1).map((x) => x.trim()).find((x) => x && !x.startsWith("#"));
    if (!next) continue;
    const bandwidth = Number.parseInt(/BANDWIDTH=(\d+)/.exec(attrs)?.[1] ?? "0", 10) || 0;
    const resolution = /RESOLUTION=(\d+)x(\d+)/.exec(attrs);
    const width = Number.parseInt(resolution?.[1] ?? "0", 10) || 0;
    const height = Number.parseInt(resolution?.[2] ?? "0", 10) || 0;
    const label = /NAME="([^"]+)"/.exec(attrs)?.[1] ?? (height > 0 ? `${height}p` : null);
    variants.push({
      url: absoluteUrl(playlistUrl, next),
      bandwidth,
      width,
      height,
      label,
    });
  }
  return variants;
}

function pickVariant(variants: Variant[], quality: string): string {
  if (variants.length === 0) throw new Error("m3u8 主播放清單沒有可用畫質");
  const normalized = quality.trim().toLowerCase();
  if (normalized && normalized !== "best") {
    const exact = variants.find((v) => v.label?.toLowerCase() === normalized);
    if (exact) return exact.url;
    const byHeight = variants.find((v) => `${v.height}p` === normalized);
    if (byHeight) return byHeight.url;
  }
  return variants
    .slice()
    .sort((a, b) => (b.height || b.bandwidth) - (a.height || a.bandwidth))[0]!.url;
}

async function resolvePlaybackUrl(pageUrl: string, quality: string): Promise<string> {
  const pageHeaders = buildMissavDocumentHeaders(pageUrl, "en-US,en;q=0.9", "fromSite");
  const html = await fetchText(pageUrl, pageHeaders);
  const parsed = parseVideoHtml(html);
  const mediaHeaders = buildCdnMediaHeaders(pageUrl, "media");
  const masterBody = await fetchText(parsed.m3u8_base_url, mediaHeaders);
  const variants = parseMasterPlaylist(masterBody, parsed.m3u8_base_url);
  if (variants.length === 0) return parsed.m3u8_base_url;
  return pickVariant(variants, quality);
}

export async function checkFfmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 8_000 });
    return true;
  } catch {
    return false;
  }
}

export async function runDownloadJob(payload: {
  jobId?: string;
  pageUrl: string;
  outputPath: string;
  quality: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const inputUrl = await resolvePlaybackUrl(payload.pageUrl, payload.quality);
    const mediaHeaders = buildCdnMediaHeaders(payload.pageUrl, "media");
    const headerBlob = Object.entries(mediaHeaders)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");

    await execFileAsync(
      "ffmpeg",
      [
        "-nostdin",
        "-y",
        "-loglevel",
        "error",
        "-user_agent",
        mediaHeaders["User-Agent"] ?? "",
        "-headers",
        `${headerBlob}\r\n`,
        "-protocol_whitelist",
        "file,http,https,tcp,tls,crypto,data",
        "-allowed_extensions",
        "ALL",
        "-extension_picky",
        "0",
        "-i",
        inputUrl,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        payload.outputPath,
      ],
      { timeout: 1000 * 60 * 60, maxBuffer: 1024 * 1024 * 8 }
    );
    return { ok: true };
  } catch (error) {
    const err = error as Error & { stderr?: string; stdout?: string };
    return {
      ok: false,
      error: summarizeErr(err.stderr || err.message || err.stdout || "下載失敗"),
    };
  }
}

export function getDownloadWorkerPoolStats(): { downloadWorkerPoolSize: number; downloadBackend: string } {
  return { downloadWorkerPoolSize: 0, downloadBackend: "node" };
}
