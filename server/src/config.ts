import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const projectRoot = path.resolve(__dirname, "..", "..");
const venvPython = path.join(projectRoot, ".venv", "bin", "python");
const venvPythonWin = path.join(projectRoot, ".venv", "Scripts", "python.exe");
const defaultPython = fs.existsSync(venvPython)
  ? venvPython
  : fs.existsSync(venvPythonWin)
    ? venvPythonWin
    : "python3";

export const config = {
  port: Number(process.env.PORT) || 3001,
  host: process.env.HOST || "0.0.0.0",
  streamSecret: process.env.STREAM_SECRET || "dev-insecure-change-me",
  pythonPath: process.env.PYTHON_PATH || defaultPython,
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
  workerScript: path.resolve(__dirname, "..", "..", "scripts", "missav_worker.py"),
  /** 同時執行的 Python 下載工作數（每個工作一個子程序） */
  downloadQueueConcurrency: Math.min(
    16,
    Math.max(1, Number.parseInt(process.env.DOWNLOAD_QUEUE_CONCURRENCY || "6", 10) || 6)
  ),
  /** 同時抓取 MissAV 影片頁 HTML 以解析縮圖的併發（卡片很多時） */
  thumbHtmlFetchConcurrency: Math.min(
    48,
    Math.max(1, Number.parseInt(process.env.THUMB_HTML_FETCH_CONCURRENCY || "24", 10) || 24)
  ),
  /** 詳情／預覽等呼叫 `fetchVideoPage` 的全域併發上限（與縮圖佇列分開，避免單頁打爆） */
  videoPageFetchConcurrency: Math.min(
    48,
    Math.max(1, Number.parseInt(process.env.VIDEO_PAGE_FETCH_CONCURRENCY || "20", 10) || 20)
  ),
  /** undici 對「同一 origin」可開的併發連線（m3u8 分片、縮圖、MissAV HTML 等共用） */
  upstreamConnectionsPerOrigin: Math.min(
    384,
    Math.max(
      48,
      Number.parseInt(process.env.UPSTREAM_CONNECTIONS_PER_ORIGIN || "192", 10) || 192
    )
  ),
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
  /** undici 對 Recombee 單一 origin 的連線數（連線重用、減少 TLS 握手） */
  recombeeConnections: Math.min(
    64,
    Math.max(4, Number.parseInt(process.env.RECOMBEE_CONNECTIONS || "24", 10) || 24)
  ),
  /** `GET /api/featured` 單次回傳筆數上限（Recombee count） */
  featuredMaxLimit: Math.min(
    120,
    Math.max(20, Number.parseInt(process.env.FEATURED_MAX_LIMIT || "100", 10) || 100)
  ),
};
