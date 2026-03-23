/**
 * 頂層分類 + 子選單（對齊 missav 行為：主項進分類頁，子項多為關鍵字搜尋）。
 */
export const NAV_MENU = [
  {
    key: "jav",
    label: "觀看日本 AV",
    to: "/c/jav",
    children: [
      { label: "最近更新", to: "/search?q=最新" },
      { label: "新作上市", to: "/search?q=新作" },
      { label: "無碼流出", to: "/search?q=無碼流出" },
      { label: "中文字幕", to: "/search?q=中文字幕" },
      { label: "女優", to: "/search?q=女優" },
      { label: "類型", to: "/search?q=類型" },
      { label: "發行商", to: "/search?q=發行商" },
    ],
  },
  {
    key: "amateur",
    label: "素人",
    to: "/c/amateur",
    children: [
      { label: "素人精選", to: "/c/amateur" },
      { label: "素人搜尋", to: "/search?q=素人" },
      { label: "FC2", to: "/search?q=FC2" },
    ],
  },
  {
    key: "uncensored",
    label: "無碼影片",
    to: "/c/uncensored",
    children: [
      { label: "無碼列表", to: "/c/uncensored" },
      { label: "無碼流出", to: "/search?q=無碼流出" },
      { label: "無碼關鍵字", to: "/search?q=無碼" },
    ],
  },
  {
    key: "madou",
    label: "亞洲 AV",
    to: "/c/madou",
    children: [
      { label: "麻豆傳媒（同分類列表）", to: "/c/madou" },
      { label: "麻豆傳媒（搜尋）", to: "/search?q=麻豆傳媒" },
      { label: "國產", to: "/search?q=國產" },
      { label: "MD", to: "/search?q=MD" },
    ],
  },
] as const;

export type NavCategoryKey = (typeof NAV_MENU)[number]["key"];

export type NavMenuChild = { label: string; to: string };

export type NavMenuItem = {
  key: NavCategoryKey;
  label: string;
  to: string;
  children: readonly NavMenuChild[];
};

export const NAV_CATEGORIES = NAV_MENU.map((m) => ({ key: m.key, label: m.label, to: m.to }));

export function isNavCategoryKey(s: string): s is NavCategoryKey {
  return NAV_MENU.some((m) => m.key === s);
}
