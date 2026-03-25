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
      { key: "recent", label: "最近更新", description: "以最近更新主題聚合的結果。", to: "/c/jav?sub=recent" },
      { key: "new-release", label: "新作上市", description: "以新作上市主題聚合的結果。", to: "/c/jav?sub=new-release" },
      { key: "uncensored-leak", label: "無碼流出", description: "以無碼流出主題聚合的結果。", to: "/c/jav?sub=uncensored-leak" },
      { key: "actresses", label: "女優一覽", description: "以女優一覽主題聚合的結果。", to: "/c/jav?sub=actresses" },
      { key: "actress-ranking", label: "女優排行", description: "以女優排行主題聚合的結果。", to: "/c/jav?sub=actress-ranking" },
      { key: "genres", label: "類型", description: "以類型主題聚合的結果。", to: "/c/jav?sub=genres" },
      { key: "makers", label: "發行商", description: "以發行商主題聚合的結果。", to: "/c/jav?sub=makers" },
      { key: "vr", label: "VR", description: "以 VR 主題聚合的結果。", to: "/c/jav?sub=vr" },
      { key: "today-hot", label: "今日熱門", description: "以今日熱門主題聚合的結果。", to: "/c/jav?sub=today-hot" },
      { key: "weekly-hot", label: "本週熱門", description: "以本週熱門主題聚合的結果。", to: "/c/jav?sub=weekly-hot" },
      { key: "monthly-hot", label: "本月熱門", description: "以本月熱門主題聚合的結果。", to: "/c/jav?sub=monthly-hot" },
      { key: "subtitles", label: "中文字幕", description: "帶中文字幕的熱門片單。", to: "/c/jav?sub=subtitles" },
    ],
  },
  {
    key: "amateur",
    label: "素人",
    description: "聚焦素人系列與相關熱門內容。",
    to: "/c/amateur",
    children: [
      { key: "siro", label: "SIRO", description: "以 SIRO 主題聚合的結果。", to: "/c/amateur?sub=siro" },
      { key: "luxu", label: "LUXU", description: "以 LUXU 主題聚合的結果。", to: "/c/amateur?sub=luxu" },
      { key: "gana", label: "GANA", description: "以 GANA 主題聚合的結果。", to: "/c/amateur?sub=gana" },
      { key: "prestige-premium", label: "PRESTIGE PREMIUM", description: "以 PRESTIGE PREMIUM 主題聚合的結果。", to: "/c/amateur?sub=prestige-premium" },
      { key: "scute", label: "S-CUTE", description: "以 S-CUTE 主題聚合的結果。", to: "/c/amateur?sub=scute" },
      { key: "ara", label: "ARA", description: "以 ARA 主題聚合的結果。", to: "/c/amateur?sub=ara" },
    ],
  },
  {
    key: "uncensored",
    label: "無碼影片",
    description: "聚焦無碼系列與相關熱門片單。",
    to: "/c/uncensored",
    children: [
      { key: "fc2", label: "FC2", description: "以 FC2 主題聚合的結果。", to: "/c/uncensored?sub=fc2" },
      { key: "heyzo", label: "HEYZO", description: "以 HEYZO 主題聚合的結果。", to: "/c/uncensored?sub=heyzo" },
      { key: "tokyohot", label: "東京熱", description: "以 東京熱 主題聚合的結果。", to: "/c/uncensored?sub=tokyohot" },
      { key: "1pondo", label: "一本道", description: "以 一本道 主題聚合的結果。", to: "/c/uncensored?sub=1pondo" },
      { key: "caribbeancom", label: "Caribbeancom", description: "以 Caribbeancom 主題聚合的結果。", to: "/c/uncensored?sub=caribbeancom" },
      { key: "caribbeancompr", label: "Caribbeancompr", description: "以 Caribbeancompr 主題聚合的結果。", to: "/c/uncensored?sub=caribbeancompr" },
      { key: "10musume", label: "10musume", description: "以 10musume 主題聚合的結果。", to: "/c/uncensored?sub=10musume" },
      { key: "pacopacomama", label: "pacopacomama", description: "以 pacopacomama 主題聚合的結果。", to: "/c/uncensored?sub=pacopacomama" },
      { key: "gachinco", label: "Gachinco", description: "以 Gachinco 主題聚合的結果。", to: "/c/uncensored?sub=gachinco" },
      { key: "xxx-av", label: "XXX-AV", description: "以 XXX-AV 主題聚合的結果。", to: "/c/uncensored?sub=xxx-av" },
      { key: "marriedslash", label: "人妻斬", description: "以 人妻斬 主題聚合的結果。", to: "/c/uncensored?sub=marriedslash" },
      { key: "naughty4610", label: "頑皮 4610", description: "以 頑皮 4610 主題聚合的結果。", to: "/c/uncensored?sub=naughty4610" },
      { key: "naughty0930", label: "頑皮 0930", description: "以 頑皮 0930 主題聚合的結果。", to: "/c/uncensored?sub=naughty0930" },
    ],
  },
  {
    key: "madou",
    label: "亞洲 AV",
    description: "聚焦麻豆、TWAV 與其它亞洲內容。",
    to: "/c/madou",
    children: [
      { key: "madou-media", label: "麻豆傳媒", description: "以 麻豆傳媒 主題聚合的結果。", to: "/c/madou?sub=madou-media" },
      { key: "twav", label: "TWAV", description: "以 TWAV 主題聚合的結果。", to: "/c/madou?sub=twav" },
      { key: "furuke", label: "Furuke", description: "以 Furuke 主題聚合的結果。", to: "/c/madou?sub=furuke" },
      { key: "k-live", label: "韓國直播", description: "以 韓國直播 主題聚合的結果。", to: "/c/madou?sub=k-live" },
      { key: "c-live", label: "中國直播", description: "以 中國直播 主題聚合的結果。", to: "/c/madou?sub=c-live" },
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
