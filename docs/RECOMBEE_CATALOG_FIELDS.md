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
| `GET /api/videos/:slug` | **HTML 解析**詳情：`genres`（第 4 格 `text-secondary` 的 `<a>`）、系列、發行商等；**不是** Recombee `values` |
| `VideoCard` | 標題：`pickTitle(values)`；縮圖角標：`has_chinese_subtitle`（中字）、`released_at`、`duration`；列表小標：**合併** `tags` + `genres` + `labels`（去重，最多 3），全空才用 `type` |

## 優化方向（已做／可選）

1. **列表標籤**：勿在「有 `tags`」時丟棄 `genres`／`labels`；改為合併去重（前端已調整）。  
2. **字幕／日期**：列表卡片已顯示 `has_chinese_subtitle`（中字）與 `released_at` 角標；`type` 小圖示仍為可選。  
3. **與官網分類頁對齊**：Recombee 與 `/dm35/madou?page=` **不同管線**；要 1:1 列表需另接列表頁抓取，非欄位文件能解。
