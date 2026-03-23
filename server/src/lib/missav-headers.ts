/** 與目前 Chrome Linux UA 字串一致（亦見 missav_api/modules/consts.py） */
export const CHROME_LINUX_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

const SEC_CH_UA =
  '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"';

/** `landing`：位址列直開首頁；`fromSite`：站內連到影片頁（帶 Referer） */
export type MissavDocumentNavKind = "landing" | "fromSite";

/**
 * MissAV HTML 請求標頭。真實瀏覽器會先「冷開」首頁（landing）再開內頁（fromSite），兩者 Sec-Fetch / Referer 不同。
 */
export function buildMissavDocumentHeaders(
  pageUrl: string,
  acceptLanguage?: string,
  nav: MissavDocumentNavKind = "fromSite"
): Record<string, string> {
  let origin = "https://missav.ws";
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    /* keep default */
  }
  const base: Record<string, string> = {
    "User-Agent": CHROME_LINUX_UA,
    "Accept-Language": acceptLanguage ?? "en-US,en;q=0.9",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Cache-Control": "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua": SEC_CH_UA,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Linux"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
  };
  if (nav === "landing") {
    base["Sec-Fetch-Site"] = "none";
    return base;
  }
  base["Sec-Fetch-Site"] = "same-origin";
  base.Referer = `${origin}/`;
  return base;
}

export type UpstreamMediaKind = "image" | "media";

export function buildCdnMediaHeaders(
  referer: string,
  kind: UpstreamMediaKind = "media"
): Record<string, string> {
  const base: Record<string, string> = {
    "User-Agent": CHROME_LINUX_UA,
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "sec-ch-ua": SEC_CH_UA,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Linux"',
    Referer: referer,
  };
  if (kind === "image") {
    return {
      ...base,
      "Sec-Fetch-Dest": "image",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "cross-site",
    };
  }
  return {
    ...base,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
  };
}
