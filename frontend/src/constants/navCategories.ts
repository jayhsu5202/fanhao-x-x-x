export type NavCategoryKey = "jav" | "amateur" | "uncensored" | "madou";

export type NavMenuChild = {
  key: string;
  label: string;
  description: string;
  to: string;
};

export type NavMenuItem = {
  key: NavCategoryKey;
  label: string;
  description: string;
  to: string;
  children: readonly NavMenuChild[];
};

export const NAV_MENU: readonly NavMenuItem[] = [
  {
    key: "jav",
    label: "觀看日本 AV",
    description: "綜合熱門與趨勢的主分類入口。",
    to: "/c/jav",
    children: [
      { key: "subtitles", label: "中文字幕", description: "帶中文字幕的熱門片單。", to: "/c/jav?sub=subtitles" },
      { key: "new-release", label: "新作上市", description: "以新作相關內容聚合。", to: "/c/jav?sub=new-release" },
      { key: "recent", label: "最近更新", description: "近期更新與熱門題材。", to: "/c/jav?sub=recent" },
    ],
  },
  {
    key: "amateur",
    label: "素人",
    description: "聚焦素人題材與相關熱門內容。",
    to: "/c/amateur",
    children: [
      { key: "featured", label: "素人精選", description: "素人題材的熱門推薦。", to: "/c/amateur?sub=featured" },
      { key: "fc2", label: "FC2", description: "聚焦 FC2 系列與相關作品。", to: "/c/amateur?sub=fc2" },
      { key: "subtitles", label: "中文字幕", description: "帶中文字幕的素人內容。", to: "/c/amateur?sub=subtitles" },
    ],
  },
  {
    key: "uncensored",
    label: "無碼影片",
    description: "聚焦無碼流出與相關熱門片單。",
    to: "/c/uncensored",
    children: [
      { key: "featured", label: "無碼精選", description: "無碼流出與相關熱門片單。", to: "/c/uncensored?sub=featured" },
      { key: "subtitles", label: "中文字幕", description: "帶中文字幕的無碼相關內容。", to: "/c/uncensored?sub=subtitles" },
      { key: "keyword", label: "無碼關鍵字", description: "無碼主題的延伸結果。", to: "/c/uncensored?sub=keyword" },
    ],
  },
  {
    key: "madou",
    label: "亞洲 AV",
    description: "聚焦亞洲與麻豆主題的熱門內容。",
    to: "/c/madou",
    children: [
      { key: "featured", label: "亞洲精選", description: "亞洲與麻豆主題的熱門內容。", to: "/c/madou?sub=featured" },
      { key: "md", label: "MD", description: "聚焦 MD 系列相關內容。", to: "/c/madou?sub=md" },
      { key: "domestic", label: "國產精選", description: "國產與亞洲代理主題。", to: "/c/madou?sub=domestic" },
    ],
  },
] as const;

export const NAV_CATEGORIES = NAV_MENU.map((m) => ({
  key: m.key,
  label: m.label,
  description: m.description,
  to: m.to,
}));

export function isNavCategoryKey(s: string): s is NavCategoryKey {
  return NAV_MENU.some((m) => m.key === s);
}

export function getNavCategory(key: string): NavMenuItem | undefined {
  return NAV_MENU.find((m) => m.key === key);
}

export function getNavSubcategory(categoryKey: string, subcategoryKey: string): NavMenuChild | undefined {
  const category = getNavCategory(categoryKey);
  return category?.children.find((item) => item.key === subcategoryKey);
}
