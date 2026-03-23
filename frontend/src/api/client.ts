import { getStoredMissavLocale } from "../lib/missavLocaleStorage";

const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const LOCALE_HEADER = "X-Missav-Locale";

/** 將後端回傳的相對路徑（/api/...）接上 VITE_API_URL；未設則走同源（Vite proxy）。 */
export function resolveApiPath(path: string): string {
  if (!path.startsWith("/")) return path;
  return base ? `${base}${path}` : path;
}

/** 影片頁／預覽／縮圖 API 帶語系（&lt;img&gt; 無法自訂標頭，必須用 query）。 */
function withMissavLocaleQuery(path: string): string {
  const loc = getStoredMissavLocale();
  if (!/^\/api\/(videos\/|thumbnail\/|preview\/)/.test(path)) return path;
  if (/[?&]locale=/.test(path)) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}locale=${encodeURIComponent(loc)}`;
}

function pathWithoutQuery(p: string): string {
  const i = p.indexOf("?");
  return i >= 0 ? p.slice(0, i) : p;
}

/** 避免瀏覽器快取同一 URL 的 JSON／圖片，導致換語系仍顯示舊內容 */
function isMissavLocaleApiPath(resolvedPath: string): boolean {
  return /^\/api\/(videos\/|thumbnail\/|preview\/)/.test(pathWithoutQuery(resolvedPath));
}

/** HLS / 下載等同源或跨網域媒體網址。 */
export function resolveMediaUrl(pathOrAbsolute: string): string {
  if (pathOrAbsolute.startsWith("http://") || pathOrAbsolute.startsWith("https://")) {
    return pathOrAbsolute;
  }
  return resolveApiPath(pathOrAbsolute);
}

export function thumbnailUrlForSlug(slug: string, localeOverride?: string): string {
  const loc = localeOverride ?? getStoredMissavLocale();
  const path = `/api/thumbnail/${encodeURIComponent(slug)}?locale=${encodeURIComponent(loc)}`;
  return resolveApiPath(path);
}

export type ApiError = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

export async function apiGet<T>(path: string): Promise<T> {
  const loc = getStoredMissavLocale();
  const p = withMissavLocaleQuery(path);
  const res = await fetch(`${base}${p}`, {
    credentials: "include",
    headers: { [LOCALE_HEADER]: loc },
    cache: isMissavLocaleApiPath(p) ? "no-store" : "default",
  });
  const data = (await res.json().catch(() => ({}))) as T | ApiError;
  if (!res.ok && data && typeof data === "object" && "error" in data) {
    const e = data as ApiError;
    throw new Error(e.error?.message || res.statusText);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return data as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const loc = getStoredMissavLocale();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [LOCALE_HEADER]: loc,
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T | ApiError;
  if (!res.ok && data && typeof data === "object" && "error" in data) {
    const e = data as ApiError;
    throw new Error(e.error?.message || res.statusText);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return data as T;
}

export function downloadFileUrl(jobId: string): string {
  return `${base}/api/downloads/${jobId}/file`;
}

/** 同源或已正確設定 CORS 時，以隱藏 a[download] 觸發存檔，避免整頁導向檔案 URL */
export function triggerSaveAsDownload(href: string, filename?: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
