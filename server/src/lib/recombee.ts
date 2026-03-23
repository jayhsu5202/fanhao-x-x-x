import crypto from "node:crypto";
import { Agent, fetch as undiciFetch } from "undici";
import { config } from "../config.js";

/** Mirrors missav_api/missav_api.py */
const BASE_HOST = "client-rapi-missav.recombee.com";
const DATABASE_ID = "missav-default";
const PUBLIC_TOKEN =
  "Ikkg568nlM51RHvldlPvc2GzZPE9R4XGzaH9Qj4zK9npbbbTly1gj9K4mgRn0QlV";

const recombeeAgent = new Agent({
  allowH2: true,
  connections: config.recombeeConnections,
  keepAliveTimeout: 60_000,
  keepAliveMaxTimeout: 600_000,
});

export class RecombeeHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RecombeeHttpError";
    this.status = status;
  }
}

function signPath(apiPath: string, token: string): string {
  const ts = Math.floor(Date.now() / 1000);
  let unsigned = `/${DATABASE_ID}${apiPath}`;
  unsigned += unsigned.includes("?") ? `&frontend_timestamp=${ts}` : `?frontend_timestamp=${ts}`;
  const signature = crypto.createHmac("sha1", token).update(unsigned, "utf8").digest("hex");
  return `${unsigned}&frontend_sign=${signature}`;
}

function backoffMs(attemptZeroBased: number): number {
  return 200 * (attemptZeroBased + 1) + Math.floor(Math.random() * 150);
}

async function recombeeRequest(url: string, init: { method: "GET" | "POST"; body?: string }): Promise<unknown> {
  const maxAttempts = config.recombeeRetries;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await undiciFetch(url, {
        method: init.method,
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body,
        dispatcher: recombeeAgent,
        signal: AbortSignal.timeout(config.recombeeTimeoutMs),
      } as Parameters<typeof undiciFetch>[1]);

      const text = await res.text();

      if (!res.ok) {
        const snippet = text.slice(0, 200);
        if (res.status === 404) {
          throw new RecombeeHttpError(404, `Recombee HTTP 404: ${snippet}`);
        }
        const retryable = res.status === 429 || (res.status >= 500 && res.status <= 599);
        if (retryable && attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, backoffMs(attempt)));
          continue;
        }
        throw new RecombeeHttpError(res.status, `Recombee HTTP ${res.status}: ${snippet}`);
      }

      try {
        return JSON.parse(text) as unknown;
      } catch (parseErr) {
        throw parseErr;
      }
    } catch (e) {
      lastErr = e;
      if (e instanceof SyntaxError) throw e;
      if (e instanceof RecombeeHttpError) {
        if (e.status === 404) throw e;
        if (e.status >= 400 && e.status < 500 && e.status !== 429) throw e;
      }
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, backoffMs(attempt)));
        continue;
      }
      throw e;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export type RecombeeSearchBodyOpts = {
  /** ReQL：與全文搜尋交集，縮小候選並提高召回相關結果 */
  filter?: string;
  booster?: string;
  /** 專家選項：low 會盡量湊滿 count（預設）；medium/high 可能回傳較少筆。 */
  minRelevance?: "low" | "medium" | "high";
};

/** 依 catalog itemId 取得屬性（REST：`GET /{db}/items/{itemId}`）。無此項目時回傳 null。 */
export async function recombeeGetItem(itemId: string): Promise<Record<string, unknown> | null> {
  const id = itemId.trim();
  if (!id) return null;
  const path = `/items/${encodeURIComponent(id)}`;
  const signed = signPath(path, PUBLIC_TOKEN);
  const url = `https://${BASE_HOST}${signed}`;
  try {
    const body = await recombeeRequest(url, { method: "GET" });
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch (e) {
    if (e instanceof RecombeeHttpError && e.status === 404) return null;
    throw e;
  }
}

export async function recombeeSearch(query: string, count: number, opts?: RecombeeSearchBodyOpts): Promise<unknown> {
  const userId = "anonymous";
  const path = `/search/users/${encodeURIComponent(userId)}/items/`;
  const signed = signPath(path, PUBLIC_TOKEN);
  const url = `https://${BASE_HOST}${signed}`;
  const body: Record<string, unknown> = {
    searchQuery: query,
    count,
    cascadeCreate: true,
    returnProperties: true,
  };
  const f = opts?.filter?.trim();
  if (f) body.filter = f;
  const b = opts?.booster?.trim();
  if (b) body.booster = b;
  const mr = opts?.minRelevance;
  if (mr === "low" || mr === "medium" || mr === "high") body.minRelevance = mr;
  return recombeeRequest(url, { method: "POST", body: JSON.stringify(body) });
}

export type RecommendToUserOpts = {
  /** 0–1，略大則每次首包較不重複（Recombee 預設 0） */
  rotationRate?: number;
  /** 秒；與 rotationRate 搭配 */
  rotationTime?: number;
  /** ReQL：只在符合條件的目錄子集內做趨勢推薦（分類頁主力） */
  filter?: string;
  booster?: string;
};

/** 首頁／匿名訪客推薦（與官方站同源 Recombee）。 */
export async function recombeeRecommendItemsToUser(
  userId: string,
  count: number,
  opts?: RecommendToUserOpts
): Promise<unknown> {
  const params = new URLSearchParams({
    count: String(count),
    cascadeCreate: "true",
    returnProperties: "true",
  });
  if (opts?.rotationRate != null && Number.isFinite(opts.rotationRate)) {
    params.set("rotationRate", String(opts.rotationRate));
  }
  if (opts?.rotationTime != null && Number.isFinite(opts.rotationTime)) {
    params.set("rotationTime", String(opts.rotationTime));
  }
  const rf = opts?.filter?.trim();
  if (rf) params.set("filter", rf);
  const rb = opts?.booster?.trim();
  if (rb) params.set("booster", rb);
  const path = `/recomms/users/${encodeURIComponent(userId)}/items/?${params.toString()}`;
  const signed = signPath(path, PUBLIC_TOKEN);
  const url = `https://${BASE_HOST}${signed}`;
  return recombeeRequest(url, { method: "GET" });
}

/** 接續 {@link recombeeRecommendItemsToUser} 的同一串推薦（用回應中的 `recommId`），供無限捲動。 */
export async function recombeeRecommendNextItems(recommId: string, count: number): Promise<unknown> {
  const rid = recommId.trim();
  if (!rid) throw new Error("缺少 recommId");
  const params = new URLSearchParams({ count: String(count) });
  const path = `/recomms/next/items/${encodeURIComponent(rid)}?${params.toString()}`;
  const signed = signPath(path, PUBLIC_TOKEN);
  const url = `https://${BASE_HOST}${signed}`;
  return recombeeRequest(url, { method: "GET" });
}

/** 詳情頁「也可看看」：以當前影片為種子做關聯推薦。 */
export async function recombeeRecommendItemsToItem(itemId: string, count: number): Promise<unknown> {
  const params = new URLSearchParams({
    targetUserId: "anonymous",
    count: String(count),
    cascadeCreate: "true",
    returnProperties: "true",
  });
  const path = `/recomms/items/${encodeURIComponent(itemId)}/items/?${params.toString()}`;
  const signed = signPath(path, PUBLIC_TOKEN);
  const url = `https://${BASE_HOST}${signed}`;
  return recombeeRequest(url, { method: "GET" });
}
