# 本機執行（Fastify + 前端）

## 前置

1. 專案根目錄已執行 `uv sync`（Python 依賴含 `missav_api`、`eaf_base_api`）。
2. 已安裝 Node.js 20+。

## 環境變數（後端）

複製 [server/.env.example](server/.env.example) 為 `server/.env` 並依需求修改。

| 變數 | 說明 |
|------|------|
| `PORT` | API 埠，預設 `3001` |
| `HOST` | 預設 `0.0.0.0` |
| `STREAM_SECRET` | 串流 token 簽章用密鑰（請改為隨機長字串） |
| `PYTHON_PATH` | 選填；未設定時會自動使用專案根 `.venv/bin/python`（若存在） |
| `DOWNLOAD_DIR` | 下載暫存目錄，預設為專案根下 `data/downloads` |
| `MISSAV_BASE_URL` | 影片頁前綴；預設 `https://missav.ws`（繁中標題）。設 `https://missav.ws/en` 則為英文頁。前端可另以 `?locale=` 或標頭 `X-Missav-Locale` 覆寫（見下） |
| `CORS_ORIGIN` | 選填；未設定時允許任意來源（方便本機）。正式環境請設為你的前端網域 |
| `PUBLIC_BASE_URL` | 選填；**留空**時 `m3u8_play_url` 與 playlist 內嵌皆為**相對路徑** `/api/stream?...`（適用 Vite `proxy` 或 Nginx 同源）。僅在前後端不同網域且無反代時才設為公開 API 根網址 |
| `MISSAV_HTML_PYTHON_ONLY` | 選填；設為 `1` 時，MissAV **影片頁 HTML** 強制只走 Python（`scripts/fetch_missav_html.py`）。預設為先 Node（undici）抓取，失敗或內容異常再回退 Python |
| `DOWNLOAD_QUEUE_CONCURRENCY` | 選填；下載佇列**同時執行**的工作數（每個工作一個 Python 子程序），預設 `6`，上限 `16` |
| `THUMB_HTML_FETCH_CONCURRENCY` | 選填；**卡片縮圖／preview** 解析 MissAV 影片頁時，同時進行的上游 HTML 抓取數，預設 `24`，上限 `48` |
| `VIDEO_PAGE_FETCH_CONCURRENCY` | 選填；詳情／預覽等 `fetchVideoPage` 併發，預設 `20`，上限 `48` |
| `UPSTREAM_CONNECTIONS_PER_ORIGIN` | 選填；undici 對**同一 origin** 的併發連線數（HLS 分片、縮圖、MissAV HTML 等），預設 `192`，上限 `384` |
| `THUMB_PARSE_CACHE_TTL_MS` | 選填；上述解析出的封面 CDN URL 記憶體快取 TTL（毫秒），預設 15 分鐘，最少 60 秒 |
| `THUMB_PARSE_CACHE_MAX_ENTRIES` | 選填；快取最多筆數，預設 `2048`，逾量刪最舊 |

前端（選用）：

| 變數 | 說明 |
|------|------|
| `VITE_API_URL` | 若前端與 API 不同網域時設為 API 根網址；開發時 Vite 已將 `/api` 代理到 `3001`，可留空 |

## 啟動

**終端 1 — API：**

```bash
cd server
npm install
npm run dev
```

預設下載目錄為專案根目錄下的 `data/downloads`（與從哪個目錄執行 `npm run dev` 無關）。

**終端 2 — 前端：**

```bash
cd frontend
npm install
npm run dev
```

瀏覽器開發網址：<http://localhost:5173>

前端路由：`/` 首頁（熱門推薦網格）、`/search?q=關鍵字` 獨立搜尋結果頁；舊書籤 `/?q=` 會自動導向 `/search?q=`。

## API 摘要

- `GET /api/health` — 健康檢查、`pythonAvailable`、`downloadQueueConcurrency`、`upstreamConnectionsPerOrigin`、縮圖／影片頁 HTML 佇列與快取：`thumbHtmlFetchConcurrency`、`thumbHtmlQueueSize`、`thumbHtmlQueuePending`、`videoPageFetchConcurrency`、`videoPageFetchQueueSize`、`videoPageFetchQueuePending`、`thumbParseCacheEntries`
- `GET /api/locales` — 可選語系列表（給前端選單）；實際抓取仍看請求上的語系
- **MissAV 語系**：`GET /api/videos/:slug`、`/api/thumbnail/:slug`、`/api/preview/:slug` 支援 query `?locale=zh-Hant|zh-Hans|en|ja|ko`（與 `missav-locale` 對照表一致），或標頭 `X-Missav-Locale`；`POST /api/downloads` 亦讀同一標頭以組 `pageUrl`
- `GET /api/search?query=&limit=` — Recombee 搜尋（1–50）；**`values` 內無圖片欄位**
- `GET /api/featured?limit=&recommId=&cursor=&fresh=` — 首頁匿名趨勢、**持續載入**：
  1. **首屏**：只帶 `limit`（預設 **80**，上限見環境變數 `FEATURED_MAX_LIMIT`，預設 **100**）→ `RecommendItemsToUser`。
  2. **同一串下一頁**：`recommId` 或 `cursor`（上一則的 `recomId`）→ `RecommendNextItems`。
  3. **`fresh=1`**：強制再打一次 `RecommendItemsToUser`（新串），與 `recommId` 並存時以 `fresh` 為準；首頁在當前串無法續時用此接續請求。
  4. **前端**：同一串用 `recommId` 續載；需要時改打 `fresh=1` 新串；列表資料不設總筆數上限。請求節流約 320ms。
  5. **後端**：Recombee 走 **undici 連線重用**與 **429／5xx 重試**；`hasMore` 在仍有 `recommId` 或本次有項目時為真，利於無限捲動銜接。
- `GET /api/browse/:category?limit=` — 分類：`jav`（日本 AV／趨勢）、`amateur`（素人）、`uncensored`（無碼）、`madou`（亞洲，關鍵字「麻豆」）
- `GET /api/recommendations?itemId=&limit=` — 詳情頁關聯推薦
- `GET /api/preview/:slug` — 只抓影片頁並回傳 `og:image` 縮圖 URL（除錯／第三方用）
- `GET /api/thumbnail/:slug` — **同源代理封面圖**（供前端 `<img>`，避免 CDN hotlink）
- `GET /api/videos/:slug` — 影片頁解析；`m3u8_play_url` 預設為相對路徑（見 `PUBLIC_BASE_URL`）
- `GET /api/stream?token=` — HLS 代理（簽名 token）
- `POST /api/downloads` — body：`{ "slug", "quality" }`（MVP 建議 `best`）。若伺服器上**已有同 slug+quality 的完成檔**，回傳同一 `jobId` 並帶 `reused: true`，不會再排隊合併
- `GET /api/downloads/by-slug/:slug?quality=` — 查該番號是否已有可下載的完成檔（`ready: true, jobId`）或進行中工作（`active: true, jobId, status`）；供前端進頁辨識、關閉分頁後仍可還原「已下載」狀態（僅限 job 仍在伺服器記憶體且檔案未刪時）
- `GET /api/downloads/:jobId` — 工作狀態；回應可含 `queue: { concurrency, pendingJobs, runningJobs }`（供前端顯示佇列負載）
- `GET /api/downloads/:jobId/file` — 完成後下載 MP4

詳情頁下載：前端會在取得 `jobId` 後寫入 **sessionStorage**（依 slug），重新整理同一分頁會自動向伺服器續查同一工作；完成後改為顯示「下載 MP4」連結（不再強制整頁跳轉）。關閉分頁即失去此記錄。下載實際合併仍由 **Python worker**（`missav_api`／`eaf_base_api`）執行；若要完全改寫成純 Node，需自行實作 m3u8 分片抓取與 ffmpeg 管線，與現有 stack 脫鉤成本高。

錯誤格式：`{ "error": { "code", "message", "details?" } }`

## 下載 worker

[scripts/missav_worker.py](scripts/missav_worker.py) 由後端子程序呼叫；因目前 `missav_api.Video.download` 與已安裝 `eaf_base_api` 的 `BaseCore.download` 簽名不一致，worker 改為直接呼叫 `video.core.download(..., downloader="threaded", ...)`。

暫存檔路徑（`DOWNLOAD_DIR` 下）：依番號第一個 `-` 分廠牌與後綴，例如 `snos-173` → `SNOS/SNOS-173/<jobId>/video.mp4`；無法解析時落在 `_misc/{slug}/<jobId>/`。過期 job 目錄會一併刪除。

## 正式建置前端

```bash
cd frontend
npm run build
```

產物在 `frontend/dist/`。可搭配任意靜態伺服器，並將 `VITE_API_URL` 設為公開的 API 網址；後端 `PUBLIC_BASE_URL` 與 `CORS_ORIGIN` 需一併調整。

## 免責

請遵守目標站條款、著作權與適用法律；本工具僅供合法授權情境使用。詳見專案 [README.md](README.md)。
