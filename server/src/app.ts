import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyReply } from "fastify";
import { config } from "./config.js";
import {
  createDownloadJob,
  findActiveJobForSlug,
  findCompletedJobForSlug,
  getDownloadQueueStats,
  getJob,
  markAbortedJobsAfterRestart,
  pruneOldJobs,
} from "./lib/download-jobs.js";
import { prisma } from "./lib/prisma.js";
import { sendError } from "./lib/errors.js";
import { rewritePlaylist } from "./lib/hls-proxy.js";
import {
  buildCdnMediaHeaders,
  fetchVideoPage,
  getVideoPageFetchQueueStats,
  parseVideoHtml,
} from "./lib/missav-page.js";
import { getBrowseCategoryMeta } from "./lib/browse-categories.js";
import { searchVariantsForRecall } from "./lib/recombee-search-variants.js";
import {
  LOCALE_OPTIONS,
  acceptLanguageForLocaleKey,
  resolveMissavBaseFromRequest,
  resolveMissavLocaleKeyFromRequest,
} from "./lib/missav-locale.js";
import {
  RecombeeHttpError,
  recombeeRecommendItemsToItem,
  recombeeRecommendItemsToUser,
  recombeeRecommendNextItems,
  recombeeSearch,
} from "./lib/recombee.js";
import { getThumbHtmlQueueStats, resolveThumbnailUrlFromPage } from "./lib/thumb-parse-cache.js";
import { upstreamFetch } from "./lib/upstream-fetch.js";
import { signStreamToken, verifyStreamToken } from "./lib/stream-token.js";

const execFileAsync = promisify(execFile);

const STREAM_TTL_SEC = 2 * 60 * 60;

function noStoreLocale(reply: FastifyReply): void {
  reply.header("Cache-Control", "private, no-store");
  reply.header("Vary", "X-Missav-Locale");
}

/** 終端機 log 用：避免把整段 Python stderr／traceback 打進一行 JSON */
function summarizeUpstreamErr(text: string, maxLen = 240): string {
  const first = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? text;
  const t = first.trim();
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

function isValidContentSlug(s: string | undefined): s is string {
  const t = s?.trim() ?? "";
  return t.length > 0 && t.length < 512 && !t.includes("..") && !t.includes("/");
}

const app = Fastify({
  logger: true,
  bodyLimit: 1024 * 64,
  requestTimeout: 120_000,
});

await app.register(cors, {
  origin: config.corsOrigin,
  credentials: true,
  /** 前端自訂標頭；未宣告時瀏覽器跨網域 preflight 會擋下 X-Missav-Locale */
  allowedHeaders: ["Content-Type", "Authorization", "X-Missav-Locale"],
});
await app.register(rateLimit, {
  max: 50_000,
  timeWindow: "1 minute",
});

async function checkPythonMissav(): Promise<boolean> {
  try {
    await execFileAsync(config.pythonPath, ["-c", "import missav_api"], {
      cwd: config.projectRoot,
      env: { ...process.env, PYTHONPATH: config.projectRoot },
      timeout: 8000,
    });
    return true;
  } catch {
    return false;
  }
}

app.get("/api/health", async () => {
  const pythonAvailable = await checkPythonMissav();
  const queue = await getDownloadQueueStats();
  return {
    ok: true,
    pythonAvailable,
    downloadQueueConcurrency: config.downloadQueueConcurrency,
    upstreamConnectionsPerOrigin: config.upstreamConnectionsPerOrigin,
    queue,
    ...getThumbHtmlQueueStats(),
    ...getVideoPageFetchQueueStats(),
  };
});

/** 供前端語系選擇器；實際抓取網址仍由 resolveMissavBaseFromRequest 決定。 */
app.get("/api/locales", async () => ({
  defaultLocale: "zh-Hant",
  locales: LOCALE_OPTIONS.map((o) => ({ ...o })),
}));

app.get("/api/search", async (request, reply) => {
  const q = request.query as { query?: string; limit?: string; recommId?: string; cursor?: string; fresh?: string };
  const query = (q.query ?? "").trim();
  if (!query) {
    return sendError(reply, 400, "BAD_REQUEST", "缺少搜尋關鍵字 query");
  }
  const def = config.recombeeFeedDefaultBatch;
  const max = config.recombeeFeedRequestMax;
  let limit = q.limit != null ? Number(q.limit) : def;
  if (!Number.isFinite(limit)) limit = def;
  limit = Math.min(max, Math.max(1, Math.floor(limit)));
  const nextRid =
    (typeof q.recommId === "string" ? q.recommId.trim() : "") ||
    (typeof q.cursor === "string" ? q.cursor.trim() : "");
  const forceFresh = q.fresh === "1" || q.fresh === "true";
  try {
    let data: Record<string, unknown>;
    if (forceFresh || !nextRid) {
      /** 番號與 itemId 一致時直查置頂；全文勿加 ReQL filter（交集會漏命中）。 */
      data = await recombeeSearchFirstPageWithRecall(query, limit);
    } else {
      try {
        data = (await recombeeRecommendNextItems(nextRid, limit)) as Record<string, unknown>;
      } catch (e) {
        if (e instanceof RecombeeHttpError) {
          data = await recombeeSearchFirstPageWithRecall(query, limit);
        } else {
          throw e;
        }
      }
    }
    const rawRecomms = Array.isArray(data.recomms) ? data.recomms : [];
    const recomms = dedupeFeaturedRecomms(rawRecomms);
    const recomId = pickRecomId(data);
    const hasMore = recombeeHasMorePages(rawRecomms, limit, recomId);
    noStoreLocale(reply);
    return { recomms, recomId, hasMore, numberNext: data.numberNext ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return sendError(reply, 502, "RECOMBEE_ERROR", "搜尋服務失敗", { detail: msg });
  }
});

function dedupeFeaturedRecomms(raw: unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const id = (x as { id?: unknown }).id;
    if (typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(x);
  }
  return out;
}

/**
 * 搜尋首包：僅 SearchItems + 變體召回。
 * 不先打 GET /items（public token 不允許，且並行多筆易逾時拖垮整次搜尋，英文關鍵字特別常觸發 slug 候選）。
 */
async function recombeeSearchFirstPageWithRecall(query: string, limit: number): Promise<Record<string, unknown>> {
  let data = (await recombeeSearch(query, limit)) as Record<string, unknown>;
  const n0 = Array.isArray(data.recomms) ? data.recomms.length : 0;
  if (n0 === 0) {
    for (const v of searchVariantsForRecall(query)) {
      if (v === query) continue;
      const alt = (await recombeeSearch(v, limit)) as Record<string, unknown>;
      const n1 = Array.isArray(alt.recomms) ? alt.recomms.length : 0;
      if (n1 > 0) {
        data = alt;
        break;
      }
    }
  }
  return data;
}

/** Recombee 回傳鍵為 `recommId`（recom**m**Id）；另相容誤拼 `recomId`。 */
function pickRecomId(data: Record<string, unknown>): string | null {
  const typo = (data as { recomId?: unknown }).recomId;
  const raw = data.recommId ?? (typeof typo === "string" ? typo : undefined) ?? data.recomm_id;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/**
 * 列表是否還可能載到更多。
 * - 本批有項目 → true（有 recommId 可走 next；首頁無 recommId 時可走 fresh=1）
 * - 本批空但有 recommId → true（再試 RecommendNextItems）
 * 僅「本批空且無 recommId」為 false。不因未滿 limit 提早 false。
 */
function recombeeHasMorePages(rawRecomms: unknown[], _limit: number, recomId: string | null): boolean {
  const n = Array.isArray(rawRecomms) ? rawRecomms.length : 0;
  if (n > 0) return true;
  return Boolean(recomId);
}

/** 首頁新串／fresh 時略旋轉，減少與已載入清單重疊（Recombee 文件 rotationRate / rotationTime） */
const FEATURED_TO_USER_OPTS = { rotationRate: 0.12, rotationTime: 7200 } as const;

app.get("/api/featured", async (request, reply) => {
  const q = request.query as { limit?: string; recommId?: string; cursor?: string; fresh?: string };
  const def = config.recombeeFeedDefaultBatch;
  const max = config.recombeeFeedRequestMax;
  let limit = q.limit != null ? Number(q.limit) : def;
  if (!Number.isFinite(limit)) limit = def;
  limit = Math.min(max, Math.max(4, Math.floor(limit)));
  const nextRid =
    (typeof q.recommId === "string" ? q.recommId.trim() : "") ||
    (typeof q.cursor === "string" ? q.cursor.trim() : "");
  const forceNewSession = q.fresh === "1" || q.fresh === "true";
  try {
    let data: Record<string, unknown>;

    if (forceNewSession) {
      data = (await recombeeRecommendItemsToUser("anonymous", limit, FEATURED_TO_USER_OPTS)) as Record<
        string,
        unknown
      >;
    } else if (nextRid) {
      try {
        data = (await recombeeRecommendNextItems(nextRid, limit)) as Record<string, unknown>;
      } catch (e) {
        if (e instanceof RecombeeHttpError) {
          data = (await recombeeRecommendItemsToUser("anonymous", limit, FEATURED_TO_USER_OPTS)) as Record<
            string,
            unknown
          >;
        } else {
          throw e;
        }
      }
    } else {
      data = (await recombeeRecommendItemsToUser("anonymous", limit, FEATURED_TO_USER_OPTS)) as Record<
        string,
        unknown
      >;
    }

    const rawRecomms = Array.isArray(data.recomms) ? data.recomms : [];
    const recomms = dedupeFeaturedRecomms(rawRecomms);
    const recomId = pickRecomId(data);
    const likelyEnd = rawRecomms.length < limit;
    const hasMore = recombeeHasMorePages(rawRecomms, limit, recomId);
    /** 避免瀏覽器快取同一 URL（尤其 ?fresh=1）導致前端去重後永遠 0 筆新項目、捲動停住 */
    noStoreLocale(reply);
    return {
      recomms,
      recomId,
      likelyEnd,
      hasMore,
      newSession: forceNewSession,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return sendError(reply, 502, "RECOMBEE_ERROR", "推薦服務失敗", { detail: msg });
  }
});

/**
 * 分類瀏覽（對應前端 /c/jav、/c/amateur 等）。
 * jav → 匿名趨勢；amateur／uncensored／madou → 目錄欄位 ReQL 篩選後趨勢（召回大於純關鍵字搜尋）。
 */
app.get("/api/browse/:category", async (request, reply) => {
  const raw = (request.params as { category: string }).category?.trim() ?? "";
  const meta = getBrowseCategoryMeta(raw);
  if (!meta) {
    return sendError(reply, 404, "NOT_FOUND", "未知的分類", { category: raw });
  }
  const q = request.query as { limit?: string; recommId?: string; cursor?: string; fresh?: string };
  const def = config.recombeeFeedDefaultBatch;
  const max = config.recombeeFeedRequestMax;
  let limit = q.limit != null ? Number(q.limit) : def;
  if (!Number.isFinite(limit)) limit = def;
  limit = Math.min(max, Math.max(4, Math.floor(limit)));
  const nextRid =
    (typeof q.recommId === "string" ? q.recommId.trim() : "") ||
    (typeof q.cursor === "string" ? q.cursor.trim() : "");
  const forceFresh = q.fresh === "1" || q.fresh === "true";
  try {
    if (meta.mode === "featured" || meta.mode === "filtered") {
      const cf = meta.mode === "filtered" ? meta.catalogFilter?.trim() : "";
      if (meta.mode === "filtered" && !cf) {
        return sendError(reply, 500, "CONFIG", "分類缺少 catalogFilter");
      }
      const recommendOpts =
        meta.mode === "filtered" && cf ? { ...FEATURED_TO_USER_OPTS, filter: cf } : FEATURED_TO_USER_OPTS;

      let data: Record<string, unknown>;
      if (forceFresh) {
        data = (await recombeeRecommendItemsToUser("anonymous", limit, recommendOpts)) as Record<string, unknown>;
      } else if (nextRid) {
        try {
          data = (await recombeeRecommendNextItems(nextRid, limit)) as Record<string, unknown>;
        } catch (e) {
          if (e instanceof RecombeeHttpError) {
            data = (await recombeeRecommendItemsToUser("anonymous", limit, recommendOpts)) as Record<
              string,
              unknown
            >;
          } else {
            throw e;
          }
        }
      } else {
        data = (await recombeeRecommendItemsToUser("anonymous", limit, recommendOpts)) as Record<string, unknown>;
      }
      const rawRecomms = Array.isArray(data.recomms) ? data.recomms : [];
      const recomms = dedupeFeaturedRecomms(rawRecomms);
      const recomId = pickRecomId(data);
      const hasMore = recombeeHasMorePages(rawRecomms, limit, recomId);
      noStoreLocale(reply);
      return {
        category: meta.key,
        label: meta.label,
        description: meta.description,
        source: meta.mode === "filtered" ? ("filtered" as const) : ("featured" as const),
        recomms,
        recomId,
        hasMore,
      };
    }

    if (meta.mode !== "search") {
      return sendError(reply, 500, "CONFIG", "未知的分類模式");
    }
    const qtext = (meta.searchQuery ?? "").trim();
    if (!qtext) {
      return sendError(reply, 500, "CONFIG", "分類缺少搜尋關鍵字");
    }
    let data: Record<string, unknown>;
    if (forceFresh || !nextRid) {
      data = await recombeeSearchFirstPageWithRecall(qtext, limit);
    } else {
      try {
        data = (await recombeeRecommendNextItems(nextRid, limit)) as Record<string, unknown>;
      } catch (e) {
        if (e instanceof RecombeeHttpError) {
          data = await recombeeSearchFirstPageWithRecall(qtext, limit);
        } else {
          throw e;
        }
      }
    }
    const rawRecomms = Array.isArray(data.recomms) ? data.recomms : [];
    const recomms = dedupeFeaturedRecomms(rawRecomms);
    const recomId = pickRecomId(data);
    const hasMore = recombeeHasMorePages(rawRecomms, limit, recomId);
    noStoreLocale(reply);
    return {
      category: meta.key,
      label: meta.label,
      description: meta.description,
      source: "search" as const,
      searchQuery: qtext,
      recomms,
      recomId,
      hasMore,
      numberNext: data.numberNext ?? null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return sendError(reply, 502, "RECOMBEE_ERROR", "分類內容載入失敗", { detail: msg });
  }
});

/** 詳情頁關聯推薦（也可看看）。 */
app.get("/api/recommendations", async (request, reply) => {
  const q = request.query as { itemId?: string; limit?: string };
  const itemId = (q.itemId ?? "").trim();
  if (!itemId || itemId.includes("/")) {
    return sendError(reply, 400, "BAD_REQUEST", "缺少或無效的 itemId");
  }
  let limit = q.limit != null ? Number(q.limit) : 16;
  if (!Number.isFinite(limit)) limit = 16;
  limit = Math.min(30, Math.max(4, Math.floor(limit)));
  try {
    const data = (await recombeeRecommendItemsToItem(itemId, limit + 2)) as Record<string, unknown>;
    const raw = Array.isArray(data.recomms) ? data.recomms : [];
    const recomms = raw.filter((r: { id?: string }) => r?.id && r.id !== itemId).slice(0, limit);
    return { recomms, recomId: pickRecomId(data) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return sendError(reply, 502, "RECOMBEE_ERROR", "關聯推薦失敗", { detail: msg });
  }
});

/** 只抓影片頁並解析 og:image；Recombee 搜尋結果沒有縮圖欄位。 */
app.get("/api/preview/:slug", async (request, reply) => {
  const slug = (request.params as { slug: string }).slug?.trim();
  if (!slug || slug.includes("..")) {
    return sendError(reply, 400, "BAD_SLUG", "無效的 slug");
  }
  const base = resolveMissavBaseFromRequest(request);
  const pageUrl = `${base}/${slug}`;
  const locKey = resolveMissavLocaleKeyFromRequest(request);
  const acceptLang = acceptLanguageForLocaleKey(locKey);
  const cacheKey = `preview:${locKey}:${slug}`;
  try {
    const thumbnail = await resolveThumbnailUrlFromPage(cacheKey, () => fetchVideoPage(pageUrl, acceptLang));
    noStoreLocale(reply);
    return { slug, thumbnail: thumbnail ?? null, page_url: pageUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return sendError(reply, 502, "PAGE_FETCH", "無法取得預覽", { detail: msg });
  }
});

app.get("/api/videos/:slug", async (request, reply) => {
  const slug = (request.params as { slug: string }).slug?.trim();
  if (!slug || slug.includes("..")) {
    return sendError(reply, 400, "BAD_SLUG", "無效的 slug");
  }
  const base = resolveMissavBaseFromRequest(request);
  const pageUrl = `${base}/${slug}`;
  const locKey = resolveMissavLocaleKeyFromRequest(request);
  const acceptLang = acceptLanguageForLocaleKey(locKey);
  let html: string;
  try {
    html = await fetchVideoPage(pageUrl, acceptLang);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return sendError(reply, 502, "PAGE_FETCH", "無法取得影片頁", { detail: msg });
  }
  let parsed;
  try {
    parsed = parseVideoHtml(html);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return sendError(reply, 502, "PARSE_ERROR", "無法解析影片頁", { detail: msg });
  }
  const exp = Math.floor(Date.now() / 1000) + STREAM_TTL_SEC;
  const token = signStreamToken(config.streamSecret, {
    exp,
    target: parsed.m3u8_base_url,
    typ: "playlist",
  });
  const enc = encodeURIComponent(token);
  const m3u8_play_url = config.publicBaseUrl
    ? `${config.publicBaseUrl}/api/stream?token=${enc}`
    : `/api/stream?token=${enc}`;
  noStoreLocale(reply);
  return {
    slug,
    page_url: pageUrl,
    m3u8_play_url,
    stream_token: token,
    ...parsed,
  };
});

/** 同源代理封面，避免 CDN 擋 hotlink、卡片 img 空白。 */
app.get("/api/thumbnail/:slug", async (request, reply) => {
  const slug = (request.params as { slug: string }).slug?.trim();
  if (!slug || slug.includes("..")) {
    return sendError(reply, 400, "BAD_SLUG", "無效的 slug");
  }
  const base = resolveMissavBaseFromRequest(request);
  const pageUrl = `${base}/${slug}`;
  const locKey = resolveMissavLocaleKeyFromRequest(request);
  const acceptLang = acceptLanguageForLocaleKey(locKey);
  const cacheKey = `thumb:${locKey}:${slug}`;
  try {
    const thumbUrl = await resolveThumbnailUrlFromPage(cacheKey, () => fetchVideoPage(pageUrl, acceptLang));
    if (!thumbUrl) {
      request.log.warn({ slug, pageUrl }, "thumbnail: parse miss (no og:image in HTML)");
      return sendError(reply, 404, "NO_THUMB", "找不到封面網址");
    }
    const res = await upstreamFetch(thumbUrl, {
      headers: buildCdnMediaHeaders(pageUrl, "image"),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      request.log.warn({ slug, status: res.status, thumb: thumbUrl.slice(0, 120) }, "thumbnail: CDN HTTP error");
      return sendError(reply, 502, "THUMB_HTTP", `封面上游 HTTP ${res.status}`);
    }
    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    reply.header("Content-Type", ct);
    noStoreLocale(reply);
    return reply.send(buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    request.log.warn(
      { slug, pageUrl, err: summarizeUpstreamErr(msg) },
      "thumbnail: upstream fetch failed (full detail in JSON body)"
    );
    return sendError(reply, 502, "THUMB_FETCH", "無法取得封面", { detail: msg });
  }
});

app.get("/api/stream", async (request, reply) => {
  const token = (request.query as { token?: string }).token;
  if (!token) {
    return sendError(reply, 400, "NO_TOKEN", "缺少 token");
  }
  let payload;
  try {
    payload = verifyStreamToken(config.streamSecret, decodeURIComponent(token));
  } catch {
    return sendError(reply, 403, "BAD_TOKEN", "token 無效或已過期");
  }

  let res: Awaited<ReturnType<typeof upstreamFetch>>;
  try {
    res = await upstreamFetch(payload.target, {
      headers: buildCdnMediaHeaders(`${config.missavBaseUrl}/`, "media"),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return sendError(reply, 502, "UPSTREAM", "無法連線至串流來源", { detail: msg });
  }

  if (!res.ok) {
    return sendError(reply, 502, "UPSTREAM_HTTP", `上游 HTTP ${res.status}`);
  }

  const ct = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());

  if (payload.typ === "segment") {
    reply.header("Content-Type", ct || "application/octet-stream");
    reply.header("Cache-Control", "public, max-age=60");
    return reply.send(buf);
  }

  const text = buf.toString("utf8");
  const looksLikePlaylist =
    text.trimStart().startsWith("#EXTM3U") || ct.includes("mpegurl");

  if (looksLikePlaylist && text.includes("#EXTM3U")) {
    const rewritten = rewritePlaylist(
      text,
      payload.target,
      config.streamSecret,
      config.publicBaseUrl,
      payload.exp
    );
    reply.header("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
    reply.header("Cache-Control", "no-cache");
    return reply.send(rewritten);
  }

  reply.header("Content-Type", ct || "application/octet-stream");
  reply.header("Cache-Control", "public, max-age=60");
  return reply.send(buf);
});

app.post("/api/downloads", async (request, reply) => {
  const body = request.body as { slug?: string; quality?: string };
  const slug = (body?.slug ?? "").trim();
  const quality = (body?.quality ?? "best").trim();
  if (!slug) {
    return sendError(reply, 400, "BAD_BODY", "缺少 slug");
  }
  const done = await findCompletedJobForSlug(slug, quality);
  if (done) {
    return { jobId: done.id, reused: true };
  }
  const active = await findActiveJobForSlug(slug, quality);
  if (active) {
    return { jobId: active.id, reused: true };
  }
  const pythonOk = await checkPythonMissav();
  if (!pythonOk) {
    return sendError(reply, 503, "PYTHON_UNAVAILABLE", "Python 環境無法載入 missav_api，請設定 PYTHON_PATH 為專案 .venv 的 python");
  }
  await fs.mkdir(config.downloadDir, { recursive: true });
  const pageBase = resolveMissavBaseFromRequest(request);
  const job = await createDownloadJob(slug, quality, pageBase);
  return { jobId: job.id, reused: false };
});

/** 依番號查伺服器是否已有可下載的完成檔或進行中工作（不需記住 jobId） */
app.get("/api/downloads/by-slug/:slug", async (request, reply) => {
  const slug = (request.params as { slug: string }).slug?.trim();
  if (!slug || slug.includes("..")) {
    return sendError(reply, 400, "BAD_SLUG", "無效的 slug");
  }
  const q = request.query as { quality?: string };
  const quality = (q.quality ?? "best").trim();
  const done = await findCompletedJobForSlug(slug, quality);
  if (done) {
    return {
      ready: true,
      active: false,
      jobId: done.id,
      status: "done" as const,
      filename: done.filename ?? null,
    };
  }
  const active = await findActiveJobForSlug(slug, quality);
  if (active) {
    return {
      ready: false,
      active: true,
      jobId: active.id,
      status: active.status,
      filename: null,
    };
  }
  return { ready: false, active: false, jobId: null, status: null, filename: null };
});

app.get("/api/favorites", async () => {
  const rows = await prisma.favorite.findMany({ orderBy: { createdAt: "desc" } });
  return {
    items: rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      createdAt: r.createdAt.toISOString(),
    })),
  };
});

app.get("/api/favorites/status/:slug", async (request, reply) => {
  const raw = (request.params as { slug: string }).slug;
  const slug = decodeURIComponent(raw ?? "").trim();
  if (!isValidContentSlug(slug)) {
    return sendError(reply, 400, "BAD_SLUG", "無效的 slug");
  }
  const row = await prisma.favorite.findUnique({ where: { slug } });
  return { favorited: Boolean(row) };
});

app.post("/api/favorites", async (request, reply) => {
  const body = request.body as { slug?: string; title?: string | null };
  const slug = (body?.slug ?? "").trim();
  if (!isValidContentSlug(slug)) {
    return sendError(reply, 400, "BAD_BODY", "無效的 slug");
  }
  const title = body?.title != null ? String(body.title).trim().slice(0, 500) || null : null;
  await prisma.favorite.upsert({
    where: { slug },
    create: { slug, title },
    update: { title },
  });
  return { ok: true as const };
});

app.delete("/api/favorites/:slug", async (request, reply) => {
  const raw = (request.params as { slug: string }).slug;
  const slug = decodeURIComponent(raw ?? "").trim();
  if (!isValidContentSlug(slug)) {
    return sendError(reply, 400, "BAD_SLUG", "無效的 slug");
  }
  await prisma.favorite.deleteMany({ where: { slug } });
  return { ok: true as const };
});

app.get("/api/downloads/:jobId", async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  const job = await getJob(jobId);
  if (!job) {
    return sendError(reply, 404, "NOT_FOUND", "找不到下載工作");
  }
  const queue = await getDownloadQueueStats();
  return {
    id: job.id,
    status: job.status,
    slug: job.slug,
    filename: job.filename,
    message: job.message,
    queue,
  };
});

app.get("/api/downloads/:jobId/file", async (request, reply) => {
  const { jobId } = request.params as { jobId: string };
  const job = await getJob(jobId);
  if (!job) {
    return sendError(reply, 404, "NOT_FOUND", "找不到下載工作");
  }
  if (job.status !== "done" || !job.outputPath) {
    return sendError(reply, 400, "NOT_READY", "檔案尚未就緒");
  }
  try {
    await fs.access(job.outputPath);
  } catch {
    return sendError(reply, 404, "FILE_MISSING", "檔案不存在");
  }
  const name = job.filename || "video.mp4";
  const stream = createReadStream(job.outputPath);
  return reply
    .header("Content-Type", "video/mp4")
    .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`)
    .send(stream);
});

await fs.mkdir(path.join(config.projectRoot, "data"), { recursive: true });
await markAbortedJobsAfterRestart();
void pruneOldJobs();

const port = config.port;
const host = config.host;
try {
  await app.listen({ port, host });
  app.log.info(`listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
