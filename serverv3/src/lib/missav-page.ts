import * as cheerio from "cheerio";
import PQueue from "p-queue";
import { config } from "../config.js";
import { fetchMissavHtml } from "./missav-html-fetch.js";

export {
  CHROME_LINUX_UA,
  buildCdnMediaHeaders,
  buildMissavDocumentHeaders,
} from "./missav-headers.js";
export type { MissavDocumentNavKind, UpstreamMediaKind } from "./missav-headers.js";

const videoPageFetchQueue = new PQueue({
  concurrency: config.videoPageFetchConcurrency,
});

export function getVideoPageFetchQueueStats(): {
  videoPageFetchConcurrency: number;
  videoPageFetchQueueSize: number;
  videoPageFetchQueuePending: number;
} {
  return {
    videoPageFetchConcurrency: config.videoPageFetchConcurrency,
    videoPageFetchQueueSize: videoPageFetchQueue.size,
    videoPageFetchQueuePending: videoPageFetchQueue.pending,
  };
}

const REGEX_THUMB = /og:image" content="(.*?)cover-n\.jpg/;
/**
 * MissAV 頁面的 JS 混淆格式：'playlist|m3u8|<uuid-parts>|<domain>|surrit|https|...|video'
 * 用 .split('|').reverse() 還原後組出 https://surrit.com/<uuid>/playlist.m3u8
 * 注意：此 regex 必須與實際頁面 JS 格式一致，如頁面更新需同步調整。
 */
const REGEX_M3U8_JS = /'m3u8(.*?)video/;

export type ParsedVideoPage = {
  title: string;
  publish_date: string;
  video_code: string;
  title_original_japanese: string;
  genres: string[];
  series: string;
  manufacturer: string;
  etiquette: string;
  thumbnail: string;
  m3u8_base_url: string;
};

export async function fetchVideoPage(pageUrl: string, acceptLanguage?: string): Promise<string> {
  const timeoutMs = 25_000;
  return videoPageFetchQueue.add(
    (): Promise<string> =>
      Promise.race([
        fetchMissavHtml(pageUrl, acceptLanguage),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("抓取影片頁逾時")), timeoutMs)
        ),
      ]),
    { throwOnTimeout: true }
  );
}

/** 僅從 HTML 取封面（與 Video.thumbnail 相同 regex），供搜尋圖卡用；Recombee values 不含圖片欄位。 */
export function parseThumbnailOnly(html: string): string | null {
  const tm = REGEX_THUMB.exec(html);
  if (!tm?.[1]) return null;
  return `${tm[1]}cover-n.jpg`;
}

function buildM3u8Url(jsChunk: string): string {
  const urlParts = jsChunk.split("|").reverse();
  if (urlParts.length < 9) throw new Error(`m3u8 js parts too short (got ${urlParts.length}): ${jsChunk.slice(0, 120)}`);
  const url = `${urlParts[1]}://${urlParts[2]}.${urlParts[3]}/${urlParts[4]}-${urlParts[5]}-${urlParts[6]}-${urlParts[7]}-${urlParts[8]}/playlist.m3u8`;
  // 防呆：確保組出的是合法 URL 且副檔名為 .m3u8
  try { new URL(url); } catch { throw new Error(`buildM3u8Url 組出無效 URL: ${url}`); }
  if (!url.includes(".m3u8")) throw new Error(`buildM3u8Url 組出非 m3u8 URL: ${url}`);
  return url;
}

export function parseVideoHtml(html: string): ParsedVideoPage {
  const m3 = REGEX_M3U8_JS.exec(html);
  if (!m3?.[1]) throw new Error("m3u8 pattern not found in page");
  const m3u8_base_url = buildM3u8Url(m3[1]);

  const tm = REGEX_THUMB.exec(html);
  if (!tm?.[1]) throw new Error("thumbnail pattern not found");
  const thumbnail = `${tm[1]}cover-n.jpg`;

  const $ = cheerio.load(html);
  const title = $('h1[class*="text-nord6"]').first().text().trim();
  if (!title) throw new Error("title not found");

  const metaRoot = $("div.space-y-2").first();
  const metaDivs = metaRoot.find("div.text-secondary").toArray();

  const getTime0 = () => $(metaDivs[0]).find("time.font-medium").first().text().trim();
  const getSpan1 = () => $(metaDivs[1]).find("span.font-medium").first().text().trim();
  const getSpan2 = () => $(metaDivs[2]).find("span.font-medium").first().text().trim();
  const genres =
    metaDivs[3] != null
      ? $(metaDivs[3])
          .find("a")
          .map((_, a) => $(a).text().trim())
          .get()
          .filter(Boolean)
      : [];
  const series =
    metaDivs[4] != null ? $(metaDivs[4]).find("a").first().text().trim() || "" : "";
  const manufacturer =
    metaDivs[5] != null ? $(metaDivs[5]).find("a").first().text().trim() || "" : "";
  const etiquette =
    metaDivs[6] != null ? $(metaDivs[6]).find("a").first().text().trim() || "" : "";

  return {
    title,
    publish_date: getTime0(),
    video_code: getSpan1(),
    title_original_japanese: metaDivs[2] != null ? getSpan2() : "",
    genres,
    series,
    manufacturer,
    etiquette,
    thumbnail,
    m3u8_base_url,
  };
}
