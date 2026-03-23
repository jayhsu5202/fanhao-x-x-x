import {
  RECOMBEE_FILTER_AMATEUR,
  RECOMBEE_FILTER_MADOU,
  RECOMBEE_FILTER_UNCENSORED,
} from "./recombee-catalog-filters.js";

/** 與 missav 行動版選單對應的分類；資料來源皆為同源 Recombee。 */

export const BROWSE_CATEGORY_KEYS = ["jav", "amateur", "uncensored", "madou"] as const;
export type BrowseCategoryKey = (typeof BROWSE_CATEGORY_KEYS)[number];

export type BrowseCategoryMeta = {
  key: BrowseCategoryKey;
  /** 選單顯示名稱 */
  label: string;
  /** 頁面副標說明 */
  description: string;
  /**
   * featured = 全站匿名趨勢；
   * filtered = RecommendItemsToUser + ReQL catalogFilter（目錄欄位子集內趨勢，無限捲動可續）；
   * search = 純 SearchItems（保留給需關鍵字驅動的場景）。
   */
  mode: "featured" | "filtered" | "search";
  /** mode===search 時必填 */
  searchQuery?: string;
  /** mode===filtered 時必填，ReQL */
  catalogFilter?: string;
};

const DEF: Record<BrowseCategoryKey, BrowseCategoryMeta> = {
  jav: {
    key: "jav",
    label: "觀看日本 AV",
    description: "綜合熱門與趨勢（匿名推薦，等同全站主流量）。",
    mode: "featured",
  },
  amateur: {
    key: "amateur",
    label: "素人",
    description:
      "依目錄 `genres`／`tags` 含「素人」篩選後，在該子集內做趨勢推薦（比單打「素人」全文搜尋覆蓋更完整）。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_AMATEUR,
  },
  uncensored: {
    key: "uncensored",
    label: "無碼影片",
    description:
      "依 `is_uncensored_leak` 或 `type==uncensored-leak` 篩選後趨勢推薦（對齊目錄欄位，不限於標題是否出現「無碼」）。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_UNCENSORED,
  },
  madou: {
    key: "madou",
    label: "亞洲 AV",
    description:
      "依標題欄位（zh／預設 title 等）含「麻豆」篩選後趨勢推薦；較贴近亞洲代理／麻豆主題區塊。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_MADOU,
  },
};

export function isBrowseCategoryKey(s: string): s is BrowseCategoryKey {
  return (BROWSE_CATEGORY_KEYS as readonly string[]).includes(s);
}

export function getBrowseCategoryMeta(key: string): BrowseCategoryMeta | null {
  const k = key.trim().toLowerCase();
  return isBrowseCategoryKey(k) ? DEF[k] : null;
}

export function listBrowseCategories(): BrowseCategoryMeta[] {
  return BROWSE_CATEGORY_KEYS.map((k) => DEF[k]);
}
