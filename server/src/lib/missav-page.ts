import * as cheerio from "cheerio";
import PQueue from "p-queue";
import { config } from "../config.js";
import { fetchMissavHtml } from "./missav-html-fetch.js";

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

/** missav_api/modules/consts.py */
/** 代理 CDN 片段時使用 */
export const CDN_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  Accept: "*/*",
};

export const MISSAV_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Cache-Control": "no-cache",
};

const REGEX_THUMB = /og:image" content="(.*?)cover-n\.jpg/;
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
  if (urlParts.length < 9) throw new Error("m3u8 js parts too short");
  return `${urlParts[1]}://${urlParts[2]}.${urlParts[3]}/${urlParts[4]}-${urlParts[5]}-${urlParts[6]}-${urlParts[7]}-${urlParts[8]}/playlist.m3u8`;
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
