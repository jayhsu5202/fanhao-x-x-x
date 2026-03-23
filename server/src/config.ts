import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const projectRoot = path.resolve(__dirname, "..", "..");

const defaultDbFile = path.join(projectRoot, "data", "app.sqlite");
if (!process.env.DATABASE_URL) {
  const abs = path.resolve(defaultDbFile);
  process.env.DATABASE_URL = `file:${abs}`;
}
const venvPython = path.join(projectRoot, ".venv", "bin", "python");
const venvPythonWin = path.join(projectRoot, ".venv", "Scripts", "python.exe");
const defaultPython = fs.existsSync(venvPython)
  ? venvPython
  : fs.existsSync(venvPythonWin)
    ? venvPythonWin
    : "python3";

const hasProjectVenv = fs.existsSync(venvPython) || fs.existsSync(venvPythonWin);

function resolvePythonPath(): string {
  const raw = (process.env.PYTHON_PATH ?? "").trim();
  if (raw.length === 0) return defaultPython;
  if (hasProjectVenv) {
    const base = path.basename(raw).replace(/\.exe$/i, "").toLowerCase();
    if (base === "python" || base === "python3") {
      return defaultPython;
    }
  }
  return raw;
}

const pythonPath = resolvePythonPath();

/**
 * 併發相關 env：正整數即採用；`0`、`-1`、`unlimited`、`max`、`infinity` → 程式內上限（65535）。
 * 非數學上的「無限」，避免開銷過大或檔案描述符耗盡；要更高可改此常數。
 */
const CONCURRENCY_CEILING = 65_535;

function parseConcurrencyEnv(raw: string | undefined, fallback: number, minParsed: number): number {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "0" || t === "-1" || t === "unlimited" || t === "max" || t === "infinity") {
    return CONCURRENCY_CEILING;
  }
  if (raw === undefined || raw.trim() === "") {
    return Math.min(CONCURRENCY_CEILING, Math.max(minParsed, fallback));
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return Math.min(CONCURRENCY_CEILING, Math.max(minParsed, fallback));
  if (n <= 0) return CONCURRENCY_CEILING;
  return Math.min(CONCURRENCY_CEILING, Math.max(minParsed, n));
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  host: process.env.HOST || "0.0.0.0",
  streamSecret: process.env.STREAM_SECRET || "dev-insecure-change-me",
  pythonPath,
  downloadDir: path.resolve(
    process.env.DOWNLOAD_DIR || path.join(projectRoot, "data", "downloads")
  ),
  /**
   * 影片頁 URL 前綴（會組成 `{base}/{slug}`）。
   * - `https://missav.ws` → 繁中介面（zh-Hant），標題／頁面為中文
   * - `https://missav.ws/cn` → 簡中
   * - `https://missav.ws/en` → 英文（標題會是英文）
   * missav_api Python 的 search 仍可能產生 `/en/{id}` 連結；slug 相同時本站用此 base 決定抓取語系。
   */
  missavBaseUrl: (process.env.MISSAV_BASE_URL || "https://missav.ws").replace(/\/$/, ""),
  /** 未設定時允許任意來源（本機開發方便）；正式環境請設 CORS_ORIGIN 為具體網域。 */
  corsOrigin:
    process.env.CORS_ORIGIN === "true" || process.env.CORS_ORIGIN === "*"
      ? true
      : process.env.CORS_ORIGIN || true,
  /**
   * 簽進 m3u8 的代理網址前綴。留空則使用相對路徑 `/api/stream`，適合 Vite proxy 或 API 與前端同源。
   * 僅當前端與 API 不同網域且無反向代理時，才設為例如 https://api.example.com
   */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""),
  projectRoot,
  /** SQLite（Prisma）；未設 DATABASE_URL 時為 `file:{projectRoot}/data/app.sqlite` */
  databaseUrl: process.env.DATABASE_URL || `file:${path.resolve(defaultDbFile)}`,
  workerScript: path.resolve(__dirname, "..", "..", "scripts", "missav_worker.py"),
  /** 同時執行的 Python 下載工作數（每個工作一個子程序）；見 `parseConcurrencyEnv` */
  downloadQueueConcurrency: parseConcurrencyEnv(process.env.DOWNLOAD_QUEUE_CONCURRENCY, 6, 1),
  /** 同時抓取 MissAV 影片頁 HTML 以解析縮圖的併發 */
  thumbHtmlFetchConcurrency: parseConcurrencyEnv(process.env.THUMB_HTML_FETCH_CONCURRENCY, 24, 1),
  /** 詳情／預覽等 `fetchVideoPage` 全域併發（與縮圖佇列分開） */
  videoPageFetchConcurrency: parseConcurrencyEnv(process.env.VIDEO_PAGE_FETCH_CONCURRENCY, 20, 1),
  /** undici 對「同一 origin」可開的併發連線（m3u8、縮圖、HTML 等共用） */
  upstreamConnectionsPerOrigin: parseConcurrencyEnv(process.env.UPSTREAM_CONNECTIONS_PER_ORIGIN, 192, 1),
  /** 解析出的封面 CDN URL 在記憶體中的 TTL（毫秒），減少重複打 MissAV 頁。預設 15 分鐘。 */
  thumbParseCacheTtlMs: Math.max(
    60_000,
    Number.parseInt(process.env.THUMB_PARSE_CACHE_TTL_MS || `${15 * 60_000}`, 10) || 15 * 60_000
  ),
  /** 快取最多保留幾筆 slug（逾量則刪最舊）。預設 2048。 */
  thumbParseCacheMaxEntries: Math.max(
    64,
    Number.parseInt(process.env.THUMB_PARSE_CACHE_MAX_ENTRIES || "2048", 10) || 2048
  ),
  /** Recombee（首頁推薦／搜尋）HTTP 逾時毫秒 */
  recombeeTimeoutMs: Math.min(
    60_000,
    Math.max(8_000, Number.parseInt(process.env.RECOMBEE_TIMEOUT_MS || "25000", 10) || 25_000)
  ),
  /** 429／5xx／網路失敗時最多重試次數（含首次共 N 次請求） */
  recombeeRetries: Math.min(
    6,
    Math.max(1, Number.parseInt(process.env.RECOMBEE_RETRIES || "3", 10) || 3)
  ),
  /** undici 對 Recombee 單一 origin 的連線數（連線重用、減少 TLS 握手）；下限 4 */
  recombeeConnections: parseConcurrencyEnv(process.env.RECOMBEE_CONNECTIONS, 24, 4),
  /**
   * 請求未帶 `limit` 時的預設筆數。`RECOMBEE_FEED_MAX_BATCH`／`FEATURED_MAX_LIMIT` 仍視為此欄位別名。
   */
  recombeeFeedDefaultBatch: Math.max(
    1,
    Number.parseInt(
      process.env.RECOMBEE_FEED_DEFAULT_BATCH ||
        process.env.RECOMBEE_FEED_MAX_BATCH ||
        process.env.FEATURED_MAX_LIMIT ||
        "100",
      10
    ) || 100
  ),
  /**
   * 單次請求允許的最大筆數（僅防 query 極大值／DoS；實際筆數由前端 `limit` 或預設決定）。
   */
  recombeeFeedRequestMax: Math.min(
    1_000_000,
    Math.max(
      8,
      Number.parseInt(process.env.RECOMBEE_FEED_REQUEST_MAX || "1000000", 10) || 1_000_000
    )
  ),
};
