# missav_api.py — Python 函式庫端點與資料結構分析報告

> 分析版本：1.5.0  
> 分析日期：2026-03-24  
> 分析範圍：`missav_api/missav_api.py`

---

## 目錄

1. [概述](#1-概述)
2. [公開類別與入口](#2-公開類別與入口)
3. [Video 物件 — 所有可取得的屬性](#3-video-物件--所有可取得的屬性)
4. [Client 方法](#4-client-方法)
5. [Recombee 搜尋資料結構](#5-recombee-搜尋資料結構)
6. [HLS 串流解析流程](#6-hls-串流解析流程)
7. [下載介面](#7-下載介面)
8. [ErrorVideo（錯誤佔位物件）](#8-errorvideo錯誤佔位物件)
9. [常數與設定](#9-常數與設定)
10. [實際測試範例](#10-實際測試範例)

---

## 1. 概述

`missav_api` 是一個非官方 Python 函式庫，透過直接抓取 MissAV 網頁 HTML 並呼叫 Recombee 推薦引擎 API，提供影片元數據擷取、搜尋、以及 HLS 下載功能。

**核心依賴**：
- `base_api`（底層 HTTP session、HLS segment 下載、ffmpeg remux）
- `BeautifulSoup`（HTML 解析）
- `lxml`（可選，優先使用；退回 `html.parser`）
- `concurrent.futures.ThreadPoolExecutor`（並行下載）

**入口**：
```python
from missav_api import Client, Video, Callback
```

---

## 2. 公開類別與入口

```python
__all__ = ["Client", "Callback", "Video"]
```

| 類別 / 物件 | 說明 |
|-------------|------|
| `Client` | 主入口，繼承 `base_api.Helper`，提供 `get_video()`、`search()` 等方法 |
| `Video` | 影片物件，所有元數據以 `@cached_property` 懶加載 |
| `Callback` | 來自 `base_api.modules.progress_bars`，用於下載進度回調 |
| `ErrorVideo` | 取得影片失敗時的佔位物件，存取任意屬性都會重新拋出原始異常 |

---

## 3. Video 物件 — 所有可取得的屬性

所有屬性均為 `@cached_property`（首次存取時從已下載的 HTML 解析，之後快取）。

### 3.1 欄位總覽

| 屬性名 | 型別 | 說明 | HTML 來源 |
|--------|------|------|----------|
| `title` | `str` | 影片標題（語言隨 URL 語系變化） | `h1.text-base.lg:text-lg.text-nord6` |
| `publish_date` | `str` | 發行日期，如 `"2023-11-01"` | `div.space-y-2 > div.text-secondary[0] > time.font-medium` |
| `video_code` | `str` | 番號，如 `"ABF-175"` | `div.text-secondary[1] > span.font-medium` |
| `title_original_japanese` | `str` | 日文原始標題（可能為空字串） | `div.text-secondary[2] > span.font-medium` |
| `genres` | `List[str]` | 分類標籤列表，如 `["美少女", "單體作品"]` | `div.text-secondary[3]` 所有 `<a>` |
| `series` | `str` | 系列名稱（可能為空字串） | `div.text-secondary[4] > a` |
| `manufacturer` | `str` | 製作公司（可能為空字串） | `div.text-secondary[5] > a` |
| `etiquette` | `str` | 標籤/禮儀（可能為空字串） | `div.text-secondary[6] > a` |
| `thumbnail` | `str` | 封面圖片完整 URL（`cover-n.jpg`） | `og:image` meta 標籤 regex |
| `m3u8_base_url` | `str` | HLS Master Playlist URL | JS 混淆字串 regex 反解 |

### 3.2 各欄位詳細說明

#### `title`
```python
video.title
# → "某某某 AV 女優の初撮り全裸..."
# 語言由 URL 決定：
#   https://missav.ws/{slug}       → 繁中
#   https://missav.ws/cn/{slug}    → 簡中
#   https://missav.ws/en/{slug}    → 英文
#   https://missav.ws/ja/{slug}    → 日文
```

#### `publish_date`
```python
video.publish_date
# → "2023-11-01"
# 格式為 YYYY-MM-DD（來自 <time> 元素 text）
```

#### `video_code`
```python
video.video_code
# → "ABF-175"
# 標準 JAV 番號格式（字母 + 數字）
```

#### `title_original_japanese`
```python
video.title_original_japanese
# → "某某某 AV 女優の初撮り..."
# 若頁面無此欄位則返回空字串 ""
```

#### `genres`
```python
video.genres
# → ["美少女", "單體作品", "中出し", "HD高畫質"]
# 若解析失敗返回空列表 []
```

#### `series`
```python
video.series
# → "某某系列"
# 若無系列返回空字串 ""
```

#### `manufacturer`
```python
video.manufacturer
# → "ABC製作"
# 若無製作公司返回空字串 ""
```

#### `etiquette`
```python
video.etiquette
# → "某標籤"
# 若無返回空字串 ""
```

#### `thumbnail`
```python
video.thumbnail
# → "https://foucs.xyz/xxxxx/cover-n.jpg"
# 從 og:image 用 regex 截取，固定加上 cover-n.jpg 後綴
# Regex: r'og:image" content="(.*?)cover-n\.jpg'
```

#### `m3u8_base_url`
```python
video.m3u8_base_url
# → "https://surrit.com/{uuid}/playlist.m3u8"
# 從頁面 JS 混淆字串反解：
#   1. regex 取出 'playlist|m3u8|uuid4|uuid3|uuid2|uuid1|uuid0|surrit|com|https|...' 片段
#   2. split('|')[::-1]（反轉）
#   3. 組合：f"{parts[1]}://{parts[2]}.{parts[3]}/{parts[4]}-{parts[5]}-{parts[6]}-{parts[7]}-{parts[8]}/playlist.m3u8"
```

---

## 4. Client 方法

### 4.1 初始化

```python
client = Client()
# 等同於：
client = Client(core=BaseCore(config=RuntimeConfig()))
```

**注意**：初始化時會強制設定 `core.config.use_http2 = False`，因為 MissAV 不支援 HTTP/2。

### 4.2 `get_video(url) → Video`

```python
video = client.get_video("https://missav.ws/abf-175")
```

- 立即下載頁面 HTML（`BaseCore.fetch(url)`）
- 回傳 `Video` 物件（屬性懶加載）
- 語言由 URL 路徑決定（見 `title` 說明）

### 4.3 `recombee_search_items(query, count, *, filter_expr, booster, timeout) → dict`

低階搜尋，直接回傳 Recombee 原始 JSON。

```python
result = client.recombee_search_items(
    query="ABF-175",
    count=20,
    filter_expr="'is_uncensored_leak' == true",  # 可選 ReQL 過濾
    booster=None,
    timeout=20,
)
```

**回傳 JSON 結構**（見第 5 節）。

### 4.4 `search(query, video_count, *, max_workers, filter_expr, booster) → Generator[Video]`

高階搜尋，自動將 Recombee 結果 URL 化後並行下載每個影片頁，逐一 yield `Video` 物件。

```python
for video in client.search("美少女", video_count=10):
    print(video.title, video.video_code)
```

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `query` | `str` | — | 搜尋關鍵字 |
| `video_count` | `int` | `50` | 最多返回影片數 |
| `max_workers` | `int \| None` | `None`（用 config）| 並行抓取執行緒數 |
| `filter_expr` | `str \| None` | `None` | Recombee ReQL 過濾表達式 |
| `booster` | `str \| None` | `None` | Recombee booster 表達式 |

**注意**：`search()` 使用 `ThreadPoolExecutor` + `as_completed`，yield 順序**不保證**與 Recombee 排名一致（由完成順序決定）。

---

## 5. Recombee 搜尋資料結構

### 5.1 請求（HMAC-SHA1 簽名）

```
POST https://client-rapi-missav.recombee.com/missav-default/search/users/anonymous/items/
     ?frontend_timestamp={unix_ts}&frontend_sign={hmac_sha1_hex}

Body:
{
  "searchQuery": "美少女",
  "count": 20,
  "cascadeCreate": true,
  "returnProperties": true,
  "minRelevance": "low",
  "filter": "'is_uncensored_leak' == true"  // 可選
}
```

簽名方式：
```
unsigned = "/missav-default/search/users/anonymous/items/?frontend_timestamp={ts}"
signature = HMAC-SHA1(key=PUBLIC_TOKEN, msg=unsigned).hexdigest()
```

### 5.2 回傳 JSON 結構

```json
{
  "recomms": [
    {
      "id": "abf-175",
      "values": {
        "title": "日本語タイトル",
        "title_zh": "繁中標題",
        "title_cn": "簡中標題",
        "title_en": "English Title",
        "released_at": 1700000000,
        "genres": ["美少女", "單體作品"],
        "tags": ["4K", "HD"],
        "is_uncensored_leak": false,
        "has_chinese_subtitle": true,
        "type": "jav",
        "manufacturer": "ABC製作",
        "series": "某系列"
      }
    }
  ],
  "recommId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "numberNextRecommsToReturn": 100
}
```

### 5.3 Recombee `values` 欄位說明

| 欄位 | 型別 | 說明 |
|------|------|------|
| `title` | `str` | 日文原標題 |
| `title_zh` | `str` | 繁體中文標題 |
| `title_cn` | `str` | 簡體中文標題 |
| `title_en` | `str` | 英文標題 |
| `released_at` | `int` | Unix