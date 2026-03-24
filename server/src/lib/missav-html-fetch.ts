import { buildMissavDocumentHeaders } from "./missav-headers.js";
import { upstreamFetch } from "./upstream-fetch.js";

/** Node-only：以 undici 抓 MissAV 影片頁，不再 fallback Python。 */
export async function fetchMissavHtml(pageUrl: string, acceptLanguage?: string): Promise<string> {
  const headers = buildMissavDocumentHeaders(pageUrl, acceptLanguage, "fromSite");
  const fetchPage = () =>
    upstreamFetch(pageUrl, {
      headers,
      signal: AbortSignal.timeout(22_000),
      redirect: "follow",
    });

  try {
    let res = await fetchPage();
    if (res.status === 403) {
      res = await fetchPage();
    }
    if (res.ok) {
      const text = await res.text();
      if (text.length > 1500 && text.includes("<!DOCTYPE html>")) {
        return text;
      }
      throw new Error("Node HTML fetch returned unexpected body");
    }
    throw new Error(`Node HTML fetch failed with status ${res.status}`);
  } catch {
    throw new Error("Node HTML fetch failed");
  }
}
