import {
  RECOMBEE_FILTER_AMATEUR,
  RECOMBEE_FILTER_CHINESE_SUBTITLE,
  RECOMBEE_FILTER_MADOU,
  RECOMBEE_FILTER_UNCENSORED,
} from "./recombee-catalog-filters.js";

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
    description: "聚焦素人系列與相關熱門內容。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_AMATEUR,
    searchQuery: "素人",
  },
  uncensored: {
    key: "uncensored",
    label: "無碼影片",
    description: "聚焦無碼系列與相關熱門片單。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_UNCENSORED,
    searchQuery: "無碼流出",
  },
  madou: {
    key: "madou",
    label: "亞洲 AV",
    description: "聚焦麻豆、TWAV 與其它亞洲內容。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_MADOU,
    searchQuery: "麻豆傳媒",
  },
};

const SUBCATEGORY_DEF: readonly BrowseSubcategoryMeta[] = [
  {
    categoryKey: "jav",
    key: "recent",
    label: "最近更新",
    description: "以最近更新關鍵字聚合的結果。",
    mode: "search",
    searchQuery: "最近更新",
  },
  {
    categoryKey: "jav",
    key: "new-release",
    label: "新作上市",
    description: "以新作上市關鍵字聚合的結果。",
    mode: "search",
    searchQuery: "新作上市",
  },
  {
    categoryKey: "jav",
    key: "uncensored-leak",
    label: "無碼流出",
    description: "以無碼流出主題聚合的片單。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_UNCENSORED,
    searchQuery: "無碼流出",
  },
  {
    categoryKey: "jav",
    key: "actresses",
    label: "女優一覽",
    description: "以女優一覽關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "女優一覽",
  },
  {
    categoryKey: "jav",
    key: "actress-ranking",
    label: "女優排行",
    description: "以女優排行關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "女優排行",
  },
  {
    categoryKey: "jav",
    key: "genres",
    label: "類型",
    description: "以類型關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "類型",
  },
  {
    categoryKey: "jav",
    key: "makers",
    label: "發行商",
    description: "以發行商關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "發行商",
  },
  {
    categoryKey: "jav",
    key: "vr",
    label: "VR",
    description: "以 VR 主題聚合的片單。",
    mode: "search",
    searchQuery: "VR",
  },
  {
    categoryKey: "jav",
    key: "today-hot",
    label: "今日熱門",
    description: "以今日熱門關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "今日熱門",
  },
  {
    categoryKey: "jav",
    key: "weekly-hot",
    label: "本週熱門",
    description: "以本週熱門關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "本週熱門",
  },
  {
    categoryKey: "jav",
    key: "monthly-hot",
    label: "本月熱門",
    description: "以本月熱門關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "本月熱門",
  },
  {
    categoryKey: "jav",
    key: "subtitles",
    label: "中文字幕",
    description: "帶中文字幕的熱門片單。",
    mode: "filtered",
    catalogFilter: RECOMBEE_FILTER_CHINESE_SUBTITLE,
    searchQuery: "中文字幕",
  },
  {
    categoryKey: "amateur",
    key: "siro",
    label: "SIRO",
    description: "以 SIRO 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "SIRO",
  },
  {
    categoryKey: "amateur",
    key: "luxu",
    label: "LUXU",
    description: "以 LUXU 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "LUXU",
  },
  {
    categoryKey: "amateur",
    key: "gana",
    label: "GANA",
    description: "以 GANA 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "GANA",
  },
  {
    categoryKey: "amateur",
    key: "prestige-premium",
    label: "PRESTIGE PREMIUM",
    description: "以 PRESTIGE PREMIUM 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "PRESTIGE PREMIUM",
  },
  {
    categoryKey: "amateur",
    key: "scute",
    label: "S-CUTE",
    description: "以 S-CUTE 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "S-CUTE",
  },
  {
    categoryKey: "amateur",
    key: "ara",
    label: "ARA",
    description: "以 ARA 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "ARA",
  },
  {
    categoryKey: "uncensored",
    key: "fc2",
    label: "FC2",
    description: "以 FC2 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "FC2",
  },
  {
    categoryKey: "uncensored",
    key: "heyzo",
    label: "HEYZO",
    description: "以 HEYZO 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "HEYZO",
  },
  {
    categoryKey: "uncensored",
    key: "tokyohot",
    label: "東京熱",
    description: "以 東京熱 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "東京熱",
  },
  {
    categoryKey: "uncensored",
    key: "1pondo",
    label: "一本道",
    description: "以 一本道 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "一本道",
  },
  {
    categoryKey: "uncensored",
    key: "caribbeancom",
    label: "Caribbeancom",
    description: "以 Caribbeancom 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "Caribbeancom",
  },
  {
    categoryKey: "uncensored",
    key: "caribbeancompr",
    label: "Caribbeancompr",
    description: "以 Caribbeancompr 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "Caribbeancompr",
  },
  {
    categoryKey: "uncensored",
    key: "10musume",
    label: "10musume",
    description: "以 10musume 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "10musume",
  },
  {
    categoryKey: "uncensored",
    key: "pacopacomama",
    label: "pacopacomama",
    description: "以 pacopacomama 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "pacopacomama",
  },
  {
    categoryKey: "uncensored",
    key: "gachinco",
    label: "Gachinco",
    description: "以 Gachinco 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "Gachinco",
  },
  {
    categoryKey: "uncensored",
    key: "xxx-av",
    label: "XXX-AV",
    description: "以 XXX-AV 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "XXX-AV",
  },
  {
    categoryKey: "uncensored",
    key: "marriedslash",
    label: "人妻斬",
    description: "以 人妻斬 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "人妻斬",
  },
  {
    categoryKey: "uncensored",
    key: "naughty4610",
    label: "頑皮 4610",
    description: "以 頑皮 4610 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "頑皮 4610",
  },
  {
    categoryKey: "uncensored",
    key: "naughty0930",
    label: "頑皮 0930",
    description: "以 頑皮 0930 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "頑皮 0930",
  },
  {
    categoryKey: "madou",
    key: "madou-media",
    label: "麻豆傳媒",
    description: "以 麻豆傳媒 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "麻豆傳媒",
  },
  {
    categoryKey: "madou",
    key: "twav",
    label: "TWAV",
    description: "以 TWAV 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "TWAV",
  },
  {
    categoryKey: "madou",
    key: "furuke",
    label: "Furuke",
    description: "以 Furuke 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "Furuke",
  },
  {
    categoryKey: "madou",
    key: "k-live",
    label: "韓國直播",
    description: "以 韓國直播 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "韓國直播",
  },
  {
    categoryKey: "madou",
    key: "c-live",
    label: "中國直播",
    description: "以 中國直播 關鍵字聚合的片單。",
    mode: "search",
    searchQuery: "中國直播",
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
