# Recombee 目錄欄位（`recomms[].values`）

**資料來源**：與 `server/src/lib/recombee.ts`、`missav_api/missav_api.py` 同一組 Recombee（`missav-default`）。  
**機器可重跑**：`python3 scripts/dump_recombee_catalog_fields.py` → 更新 `docs/recombee-catalog-field-inventory.json`。

## 掃描摘要（範例執行）

| 項目 | 值 |
|------|-----|
| `recomm` 頂層鍵 | `id`, `values` |
| `values` 鍵數量 | 29（實際目錄以 Recombee 為準，可能擴充） |
| 取樣 | search「麻豆傳媒」20 筆 + search「素人」20 筆 + featured 20 筆（以 `recombee-catalog-field-inventory.json` 的 `generatedAt` 為準） |

## 完整欄位表（`values`）

| 鍵 | 型別（掃描所見） | 用途建議 |
|----|------------------|----------|
| `title` | string | 預設標題；列表可當 fallback |
| `title_zh` | string | 繁中標題（`VideoCard.pickTitle` 已優先） |
| `title_cn` | string | 簡中標題 |
| `title_en` … `title_vi` 等 | string | 各語系標題 |
| `duration` | int（秒） | 卡片時長 badge |
| `type` | string | 內容類型 slug（如 `uncensored-leak`） |
| `tags` | string[]，常為空 | 細粒度標籤；與 `genres` 併用較完整 |
| `genres` | string[] | 類型／題材（日語等） |
| `labels` | string[] | 英文等短標籤 |
| `markers` | string[] | 標記／出品等 |
| `series` | string[] | 系列名 |
| `actors` | string[] | 男優 |
| `actresses` | string[] | 女優 |
| `actresses_count` | int | 女優人數 |
| `directors` | string[] | 導演 |
| `released_at` | float（Unix 秒） | 發行時間排序／顯示可轉日期 |
| `has_chinese_subtitle` | bool | UI 角標 |
| `has_english_subtitle` | bool | UI 角標 |
| `is_uncensored_leak` | bool | 無碼流出等旗標 |
| `dm` | int | 內部分類／權重（語意依官方 catalog） |

## 本專案怎麼用

| 路徑 | 行為 |
|------|------|
| `GET /api/search`、`/api/featured`、`/api/browse/*` | 回傳 `recomms` **原樣保留** `id` + `values`（僅依 `id` 去重） |
| `GET /api/browse/jav` | 全站匿名趨勢（無 ReQL filter） |
| `GET /api/browse/amateur`、`uncensored`、`madou` | `RecommendItemsToUser` + **ReQL `filter`**（`recombee-catalog-filters.ts`）：依 `genres`／`tags`、`is_uncensored_leak`／`type`、標題含「麻豆」等**先篩目錄子集**，再在子集內趨勢推薦（無限捲動仍走 `recommId`） |
| `GET /api/search` | **純 SearchItems 全文**（Recombee 索引字串與集合欄位，含標題／標籤等；**不加** ReQL `filter`，避免與全文變成交集而漏番號／標題命中）。首包若 0 筆，會自動試 **查詢變體**（空白、`-`、大小寫、NFKC 等，見 `recombee-search-variants.ts`） |
| `GET /api/videos/:slug` | **HTML 解析**詳情：`genres`（第 4 格 `text-secondary` 的 `<a>`）、系列、發行商等；**不是** Recombee `values` |
| `VideoCard` | 標題：`pickTitle(values)`；縮圖角標：`has_chinese_subtitle`（中字）、`duration`；列表小標：**合併** `tags` + `genres` + `labels`（去重，最多 3），全空才用 `type` |

## 優化方向（已做／可選）

1. **列表標籤**：勿在「有 `tags`」時丟棄 `genres`／`labels`；改為合併去重（前端已調整）。  
2. **字幕**：列表卡片可顯示 `has_chinese_subtitle`（中字）；`released_at`／`type` 小圖示仍為可選。  
3. **與官網分類頁對齊**：Recombee 與官網 `dm*` 列表 HTML **不同管線**；要 1:1 筆數／分頁需另接列表頁抓取，**無法**只靠 `values` 欄位優化成與 missav.ws 相同。

## 官網導覽路徑對照（瀏覽器實測，2026-03-23）

以下為 **https://missav.ws** 繁中站頁尾「影片／搜尋」對應的**固定路徑**（與本站 Recombee `/api/search`、`/c/*` **不同源**）。**本站導覽列**僅連到 SPA（`/search`、`/c/*`），下表僅供對照／整合參考。

| 選單意義 | 官網 path（相對） | 備註 |
|----------|-------------------|------|
| 最近更新 | `/new` | 實際會轉到 `/dm*/new` 等 |
| 新作上市 | `/release` | |
| 無碼流出 | `/uncensored-leak` | |
| 中文字幕 | `/chinese-subtitle` | |
| 女優 | `/actresses` | **`/actors` 為男優** |
| 類型 | `/genres` | |
| 發行商 | `/makers` | |
| 類型「素人」 | `/genres/%E7%B4%A0%E4%BA%BA` | 會轉到 `/dm*/genres/…` |
| FC2 搜尋 | `/cn?q=FC2` | **`/search?q=…` 實測 404** |
| 麻豆傳媒 | `/madou` | 會轉到 `/dm35/madou` |

**勿誤用**：`/amateur`、`/uncensored` 在官網為 **404**；無碼流出請用 `/uncensored-leak`。

機器可讀摘要已寫入 `recombee-catalog-field-inventory.json` 的 **`officialNavReference`**（與 `valueKeys` 並列，重跑 `dump_recombee_catalog_fields.py` 會保留該區塊邏輯）。
