import { buildMissavDocumentHeaders } from "./missav-headers.js";
import { fetchMissavHtmlViaPythonPool } from "./python-html-worker-pool.js";
import { upstreamFetch } from "./upstream-fetch.js";

/**
 * 優先 Node（undici）抓 MissAV 影片頁；失敗再交給長駐 Python 程序池（重用 session，非每次冷啟動）。
 * `MISSAV_HTML_PYTHON_ONLY=1` 時略過 Node，全走 Python。
 */
export async function fetchMissavHtml(pageUrl: string, acceptLanguage?: string): Promise<string> {
  if (process.env.MISSAV_HTML_PYTHON_ONLY === "1") {
    return fetchMissavHtmlViaPythonPool(pageUrl, acceptLanguage);
  }

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
    }
  } catch {
    /* fall through to Python */
  }

  return fetchMissavHtmlViaPythonPool(pageUrl, acceptLanguage);
}
