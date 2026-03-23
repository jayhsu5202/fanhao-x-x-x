/** 與 missav 行動版選單對應的分類；資料來源皆為同源 Recombee。 */

export const BROWSE_CATEGORY_KEYS = ["jav", "amateur", "uncensored", "madou"] as const;
export type BrowseCategoryKey = (typeof BROWSE_CATEGORY_KEYS)[number];

export type BrowseCategoryMeta = {
  key: BrowseCategoryKey;
  /** 選單顯示名稱 */
  label: string;
  /** 頁面副標說明 */
  description: string;
  /** featured = 匿名趨勢；search = 以關鍵字搜尋（可視實際結果調整關鍵字） */
  mode: "featured" | "search";
  searchQuery?: string;
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
    description: "以「素人」關鍵字搜尋 Recombee 目錄。",
    mode: "search",
    searchQuery: "素人",
  },
  uncensored: {
    key: "uncensored",
    label: "無碼影片",
    description: "以「無碼」關鍵字搜尋；與官方分類標籤未必完全一致。",
    mode: "search",
    searchQuery: "無碼",
  },
  madou: {
    key: "madou",
    label: "亞洲 AV",
    description:
      "對齊 missav「麻豆傳媒」分類頁主題；以 Recombee 搜尋「麻豆傳媒」（與官網全文索引未必 1:1，但比單字「麻豆」更贴近該區列表）。",
    mode: "search",
    searchQuery: "麻豆傳媒",
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
