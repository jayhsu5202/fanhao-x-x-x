/** 與 Recombee `values`、列表卡片顯示邏輯共用 */

export function pickTitle(v: Record<string, unknown> | undefined, id: string): string {
  if (!v) return id;
  const zh = v.title_zh;
  const cn = v.title_cn;
  const en = v.title_en;
  const t = v.title;
  if (typeof zh === "string" && zh) return zh;
  if (typeof cn === "string" && cn) return cn;
  if (typeof en === "string" && en) return en;
  if (typeof t === "string" && t) return t;
  return id;
}

export const LIST_CHIPS_MAX = 3;

export function pickListChips(v: Record<string, unknown> | undefined, max: number): string[] {
  if (!v) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const pushFrom = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const x of arr) {
      if (typeof x !== "string" || !x.trim()) continue;
      const t = x.trim();
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= max) return;
    }
  };
  pushFrom(v.tags);
  pushFrom(v.genres);
  pushFrom(v.labels);
  if (out.length > 0) return out;
  const typ = v.type;
  if (typeof typ === "string" && typ.trim()) return [typ.trim()];
  return [];
}

/** 詳情頁「類型」區塊：盡量用目錄 genres */
export function pickGenresForDetail(v: Record<string, unknown> | undefined): string[] {
  if (!v) return [];
  const g = v.genres;
  if (!Array.isArray(g)) return [];
  return g.filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map((x) => x.trim());
}
