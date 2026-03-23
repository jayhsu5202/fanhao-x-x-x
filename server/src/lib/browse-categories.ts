import {
  RECOMBEE_FILTER_AMATEUR,
  RECOMBEE_FILTER_CHINESE_SUBTITLE,
  RECOMBEE_FILTER_FC2,
  RECOMBEE_FILTER_MADOU,
  RECOMBEE_FILTER_UNCENSORED,
} from "./recombee-catalog-filters.js";

/** 與 missav 行動版選單對應的分類；資料來源皆為同源 Recombee。 */

export const BROWSE_CATEGORY_KEYS = ["jav", "amateur", "uncensored", "madou"] as const;
export type BrowseCategoryKey = (typeof BROWSE_CATEGORY_KEYS)[number];
export type BrowseMode = "featured" | "filtered" | "search";

export type BrowseCategoryMeta = {
  key: BrowseCategoryKey;
  label: string;
  description: string;
  mode: BrowseMode;
  searchQuery?: string;
  catalogFilter?: string;
};

export type BrowseSubcategoryMeta = {
  categoryKey: BrowseCategoryKey;
  key: string;
  label: string;
  description: string;
  mode: BrowseMode;
  searchQuery?: string;
  catalogFilter?: string;
};

const DEF: Record<BrowseCategoryKey, BrowseCategoryMeta> = {
  jav: {
    key: "jav",
    label: "觀看日本 AV",
    description: "綜合熱門與趨勢的主分類入口。",
    mode: "featured",
  },
  amateur: {
    key: "amateur",
    label: "素人",
    description: "聚焦素人題材與相關熱門內容。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_AMATEUR,
  },
  uncensored: {
    key: "uncensored",
    label: "無碼影片",
    description: "聚焦無碼流出與相關熱門片單。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_UNCENSORED,
  },
  madou: {
    key: "madou",
    label: "亞洲 AV",
    description: "聚焦亞洲與麻豆主題的熱門內容。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_MADOU,
  },
};

const andFilter = (...parts: Array<string | undefined>): string => parts.filter(Boolean).map((x) => `(${x})`).join(" and ");

const SUBCATEGORY_DEF: readonly BrowseSubcategoryMeta[] = [
  {
    categoryKey: "jav",
    key: "subtitles",
    label: "中文字幕",
    description: "優先顯示帶中文字幕的熱門片單。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_CHINESE_SUBTITLE,
    searchQuery: "中文字幕",
  },
  {
    categoryKey: "jav",
    key: "new-release",
    label: "新作上市",
    description: "以新作相關關鍵字聚合的近期片單。",
    mode: "search",
    searchQuery: "新作",
  },
  {
    categoryKey: "jav",
    key: "recent",
    label: "最近更新",
    description: "近期更新與熱門題材的綜合結果。",
    mode: "search",
    searchQuery: "最新",
  },
  {
    categoryKey: "amateur",
    key: "featured",
    label: "素人精選",
    description: "素人題材的熱門推薦。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_AMATEUR,
    searchQuery: "素人",
  },
  {
    categoryKey: "amateur",
    key: "fc2",
    label: "FC2",
    description: "聚焦 FC2 系列與相關作品。",
    mode: "search",
    searchQuery: "FC2",
  },
  {
    categoryKey: "amateur",
    key: "subtitles",
    label: "中文字幕",
    description: "優先顯示帶中文字幕的素人內容。",
    mode: "filtered",
    catalogFilter: andFilter(RECOMBEE_FILTER_AMATEUR, RECOMBEE_FILTER_CHINESE_SUBTITLE),
    searchQuery: "素人 中文字幕",
  },
  {
    categoryKey: "uncensored",
    key: "featured",
    label: "無碼精選",
    description: "無碼流出與相關熱門片單。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_UNCENSORED,
    searchQuery: "無碼流出",
  },
  {
    categoryKey: "uncensored",
    key: "subtitles",
    label: "中文字幕",
    description: "帶中文字幕的無碼相關內容。",
    mode: "filtered",
    catalogFilter: andFilter(RECOMBEE_FILTER_UNCENSORED, RECOMBEE_FILTER_CHINESE_SUBTITLE),
    searchQuery: "無碼 中文字幕",
  },
  {
    categoryKey: "uncensored",
    key: "keyword",
    label: "無碼關鍵字",
    description: "以無碼關鍵字延伸的更多結果。",
    mode: "search",
    searchQuery: "無碼",
  },
  {
    categoryKey: "madou",
    key: "featured",
    label: "亞洲精選",
    description: "亞洲與麻豆主題的熱門內容。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_MADOU,
    searchQuery: "麻豆傳媒",
  },
  {
    categoryKey: "madou",
    key: "md",
    label: "MD",
    description: "聚焦 MD 系列相關內容。",
    mode: "search",
    searchQuery: "MD",
  },
  {
    categoryKey: "madou",
    key: "domestic",
    label: "國產精選",
    description: "國產與亞洲代理主題相關片單。",
    mode: "search",
    searchQuery: "國產",
  },
] as const;

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

export function listBrowseSubcategories(categoryKey: string): BrowseSubcategoryMeta[] {
  const k = categoryKey.trim().toLowerCase();
  if (!isBrowseCategoryKey(k)) return [];
  return SUBCATEGORY_DEF.filter((item) => item.categoryKey === k);
}

export function getBrowseSubcategoryMeta(categoryKey: string, subcategoryKey: string): BrowseSubcategoryMeta | null {
  const ck = categoryKey.trim().toLowerCase();
  if (!isBrowseCategoryKey(ck)) return null;
  const sk = subcategoryKey.trim().toLowerCase();
  return SUBCATEGORY_DEF.find((item) => item.categoryKey === ck && item.key === sk) ?? null;
}
