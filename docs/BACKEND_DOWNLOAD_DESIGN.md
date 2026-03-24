# 後端下載系統設計文件

> 版本：serverv3（純 Node.js）  
> 更新日期：2026-03-24

---

## 1. 概述

本後端採用**純 Node.js HLS 分段並行下載**策略，完全移除對系統 ffmpeg CLI 的依賴（用於 HLS 串流拉取）。下載流程仿照 Python `missav_api` 的 `threaded` downloader，直接下載每個 MPEG-TS segment 後串接，最後用捆綁的 ffmpeg 做格式轉換（remux），不涉及 HLS demuxer。

---

## 2. 為什麼不用 ffmpeg 直接拉 HLS？

MissAV 的 HLS sub-playlist 中，segment 副檔名為 `.jpeg`（如 `video0.jpeg`），但實際格式是 **MPEG-TS**（H.264 + AAC），屬於防盜偽裝。

```
# 1080p/video.m3u8 示例
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:4.004000,
video0.jpeg        ← 真實格式是 MPEG-TS，不是圖片
video1.jpeg
...
```

**ffmpeg 8.x** 新增了嚴格的 segment extension 驗證（CVE-2023-6602），偵測到 `detected format: mpegts` 但副檔名為 `.jpeg` 時直接拒絕輸入，任何 `-allowed_extensions` 參數均無法繞過。

捆綁的 `@ffmpeg-installer/ffmpeg`（2018 年版）雖可繞過此限制，但僅用於最後的 **remux 步驟**（純容器格式轉換，不涉及 HLS demuxer）。

---

## 3. 下載請求流程

### 3.1 前端觸發

```
前端
  └─ POST /api/downloads
       { slug: "abf-175", quality: "1080p" }
```

後端回應：
```json
{ "jobId": "uuid", "reused": false }
```

若相同 slug + quality 已有完成的 job，回傳：
```json
{ "jobId": "uuid", "reused": true, "status": "done" }
```

若正在進行中：
```json
{ "jobId": "uuid", "reused": true, "status": "running" }
```

### 3.2 前端輪詢

```
前端
  └─ GET /api/downloads/:jobId
       → { status: "pending" | "running" | "verifying" | "done" | "error", ... }
```

前端每 3 秒輪詢一次，直到 status 為 `done` 或 `error`。

### 3.3 完成後下載檔案

```
前端
  └─ GET /api/downloads/:jobId/file
       → 302 redirect 或直接回傳 video.mp4
```

---

## 4. 後端下載執行流程（`hls-downloader.ts`）

```
createDownloadJob(slug, quality)
  │
  ├─ 1. 建立資料夾：data/downloads/{番號前3碼}/{番號}/{jobId}/
  │       例：data/downloads/ABF/ABF-175/uuid/video.mp4
  │
  ├─ 2. 抓影片頁 HTML（missav-html-fetch.ts）
  │       → fetchVideoPage(pageUrl)
  │
  ├─ 3. 解析 m3u8_base_url（missav-page.ts）
  │       regex: /'m3u8(.*?)video/
  │       → buildM3u8Url(chunk)
  │       → https://surrit.com/{uuid}/playlist.m3u8
  │
  ├─ 4. 抓 Master Playlist
  │       GET https://surrit.com/{uuid}/playlist.m3u8
  │       → 解析各品質 (360p/480p/720p/1080p) variant URL
  │
  ├─ 5. 選品質，抓 Sub-Playlist
  │       GET https://surrit.com/{uuid}/1080p/video.m3u8
  │       → 解析 segment 清單（video0.jpeg, video1.jpeg, ...）
  │
  ├─ 6. 並行下載所有 segments（最多 20 並發，retry 3 次）
  │       GET https://surrit.com/{uuid}/1080p/video0.jpeg  ← 真實 MPEG-TS
  │       GET https://surrit.com/{uuid}/1080p/video1.jpeg
  │       ...
  │
  ├─ 7. 串接 segments → 暫存 video.mp4.ts（raw concat MPEG-TS）
  │
  ├─ 8. ffmpeg remux .ts → .mp4
  │       使用捆綁的 @ffmpeg-installer（2018 年舊版）
  │       ffmpeg -i video.mp4.ts -c copy -movflags +faststart -bsf:a aac_adtstoasc video.mp4
  │
  └─ 9. 驗證輸出檔（> 256KB），更新 DB 狀態 → done
```

---

## 5. 資料庫（SQLite + Prisma）

### DownloadJob 欄位

| 欄位 | 說明 |
|------|------|
| `id` | UUID，jobId |
| `slug` | 影片番號，如 `abf-175` |
| `quality` | 品質，如 `1080p` |
| `status` | `pending` / `running` / `verifying` / `done` / `error` |
| `message` | 當前狀態描述 |
| `outputPath` | 輸出 mp4 檔案絕對路徑 |
| `filename` | 建議下載檔名，如 `abf-175.mp4` |
| `fileSizeBytes` | 最終檔案大小（bytes）|
| `ffmpegSummary` | 下載摘要（已下載 N 個 segment）|
| `startedAt` | 開始時間 |
| `finishedAt` | 結束時間 |
| `verifiedAt` | 驗證完成時間 |

### 資料夾結構

```
data/
  downloads/
    ABF/              ← slug 前3字元
      ABF-175/        ← slug
        {jobId}/
          video.mp4   ← 最終輸出
```

---

## 6. API 端點

### POST `/api/downloads`

**請求：**
```json
{ "slug": "abf-175", "quality": "1080p" }
```

**回應（新任務）：**
```json
{ "jobId": "uuid", "reused": false }
```

**回應（已完成，可重用）：**
```json
{ "jobId": "uuid", "reused": true, "status": "done" }
```

**回應（進行中）：**
```json
{ "jobId": "uuid", "reused": true, "status": "running" }
```

---

### GET `/api/downloads/:jobId`

**回應：**
```json
{
  "id": "uuid",
  "status": "done",
  "slug": "abf-175",
  "quality": "1080p",
  "message": "完成",
  "filename": "abf-175.mp4",
  "fileSizeBytes": 2147483648,
  "ffmpegSummary": "已下載 2390 個 segment",
  "startedAt": 1742800000000,
  "finishedAt": 1742803600000,
  "verifiedAt": 1742803601000,
  "createdAt": 1742800000000
}
```

---

### GET `/api/downloads/:jobId/file`

完成的任務可直接下載 mp4 檔案。

---

### GET `/api/downloads/by-slug/:slug`

查詢特定番號是否已有完成或進行中的任務（無需記住 jobId）。

---

## 7. 關鍵實作檔案

| 檔案 | 職責 |
|------|------|
| `src/lib/hls-downloader.ts` | HLS 分段下載核心：解析 playlist、並行下載 segments、remux |
| `src/lib/download-jobs.ts` | 任務佇列管理（PQueue）、DB 狀態更新 |
| `src/lib/missav-page.ts` | 抓 MissAV 影片頁 HTML、解析 m3u8_base_url 與 thumbnail |
| `src/lib/missav-html-fetch.ts` | HTTP session pool，帶正確 headers 繞過 WAF |
| `src/lib/missav-headers.ts` | Chrome Linux UA 與 CDN 請求標頭 |
| `src/lib/upstream-fetch.ts` | undici Agent（HTTP/1.1）封裝 |
| `src/app.ts` | Fastify 路由定義 |

---

## 8. m3u8 URL 解析邏輯

MissAV 頁面的 JavaScript 混淆格式：

```
'playlist|m3u8|{uuid4}|{uuid3}|{uuid2}|{uuid1}|{uuid0}|surrit|com|https|video|...'
```

Regex 捕捉 `m3u8` 到 `video` 之間的內容：
```typescript
const REGEX_M3U8_JS = /'m3u8(.*?)video/;
// 捕捉到：'|uuid4|uuid3|uuid2|uuid1|uuid0|com|surrit|https|'
```

`split('|').reverse()` 後按索引組 URL：
```typescript
url = `${parts[1]}://${parts[2]}.${parts[3]}/${parts[4]}-${parts[5]}-${parts[6]}-${parts[7]}-${parts[8]}/playlist.m3u8`
// → https://surrit.com/{uuid}/playlist.m3u8
```

---

## 9. 下載並發設定

| 設定 | 預設值 | 說明 |
|------|--------|------|
| `DOWNLOAD_QUEUE_CONCURRENCY` | `2` | 同時進行的下載任務數 |
| segment 並發 | `min(20, segmentCount)` | 單一任務的 segment 並行數 |
| segment retry | `3` | 單一 segment 失敗重試次數 |
| segment timeout | `1h` | 整體下載 abort signal |
