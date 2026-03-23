import type { IncomingHttpHeaders } from "node:http";
import type { FastifyRequest } from "fastify";
import { config } from "../config.js";

function headerFirst(headers: IncomingHttpHeaders, lowerName: string): string {
  const v = headers[lowerName];
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && v[0] != null) return String(v[0]).trim();
  return "";
}

function queryLocaleString(query: FastifyRequest["query"]): string {
  if (query == null || typeof query !== "object") return "";
  const raw = (query as Record<string, unknown>).locale;
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

/**
 * 與 missav 各語系路徑對齊（見影片頁 &lt;link rel="alternate" hreflang&gt;）。
 * 前端以 query ?locale= 或標頭 X-Missav-Locale 傳入 id。
 */
export const MISSAV_LOCALE_MAP: Record<string, string> = {
  "zh-Hant": "https://missav.ws",
  "zh-Hans": "https://missav.ws/cn",
  en: "https://missav.ws/en",
  ja: "https://missav.ws/ja",
  ko: "https://missav.ws/ko",
  ms: "https://missav.ws/ms",
  th: "https://missav.ws/th",
  de: "https://missav.ws/de",
  fr: "https://missav.ws/fr",
  vi: "https://missav.ws/vi",
  id: "https://missav.ws/id",
  fil: "https://missav.ws/fil",
  pt: "https://missav.ws/pt",
};

export const LOCALE_OPTIONS = [
  { id: "zh-Hant", label: "繁體中文", short: "繁" },
  { id: "zh-Hans", label: "简体中文", short: "简" },
  { id: "en", label: "English", short: "EN" },
  { id: "ja", label: "日本語", short: "JA" },
  { id: "ko", label: "한국어", short: "KO" },
] as const;

/** Node 抓取 MissAV HTML 時一併帶上，與路徑語系互補 */
export const MISSAV_ACCEPT_LANGUAGE: Record<string, string> = {
  "zh-Hant": "zh-TW,zh-HK,zh;q=0.9,en;q=0.65",
  "zh-Hans": "zh-CN,zh;q=0.9,en;q=0.65",
  en: "en-US,en;q=0.9",
  ja: "ja-JP,ja;q=0.9",
  ko: "ko-KR,ko;q=0.9",
  ms: "ms-MY,ms;q=0.9,en;q=0.65",
  th: "th-TH,th;q=0.9,en;q=0.65",
  de: "de-DE,de;q=0.9,en;q=0.65",
  fr: "fr-FR,fr;q=0.9,en;q=0.65",
  vi: "vi-VN,vi;q=0.9,en;q=0.65",
  id: "id-ID,id;q=0.9,en;q=0.65",
  fil: "fil-PH,fil;q=0.9,en;q=0.65",
  pt: "pt-BR,pt;q=0.9,en;q=0.65",
};

export function acceptLanguageForLocaleKey(localeKey: string): string {
  return MISSAV_ACCEPT_LANGUAGE[localeKey] ?? "en-US,en;q=0.9";
}

/** 供抓取 HTML 時對齊 Accept-Language（無請求語系時依 MISSAV_BASE_URL 反查） */
export function resolveMissavLocaleKeyFromRequest(request: FastifyRequest): string {
  const ql = queryLocaleString(request.query);
  const hl = headerFirst(request.headers, "x-missav-locale");
  const key = ql || hl;
  if (key && MISSAV_LOCALE_MAP[key]) return key;
  const base = config.missavBaseUrl;
  for (const [k, v] of Object.entries(MISSAV_LOCALE_MAP)) {
    if (v.replace(/\/$/, "") === base) return k;
  }
  return "zh-Hant";
}

export function resolveMissavBaseFromRequest(request: FastifyRequest): string {
  const ql = queryLocaleString(request.query);
  const hl = headerFirst(request.headers, "x-missav-locale");
  const key = ql || hl;
  if (key && MISSAV_LOCALE_MAP[key]) {
    return MISSAV_LOCALE_MAP[key].replace(/\/$/, "");
  }
  return config.missavBaseUrl;
}
