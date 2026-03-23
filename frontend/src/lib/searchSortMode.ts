import type { RecommItem } from "../components/VideoCard";

export type SearchSortMode = "relevance" | "released_desc" | "released_asc";

export function parseSearchSortModeParam(raw: string | null): SearchSortMode {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "released_desc" || t === "date_desc" || t === "new") return "released_desc";
  if (t === "released_asc" || t === "date_asc" || t === "old") return "released_asc";
  return "relevance";
}

function releasedTs(v: Record<string, unknown> | undefined): number | null {
  if (!v) return null;
  const r = v.released_at;
  if (typeof r === "number" && Number.isFinite(r)) return r;
  return null;
}

/** 無限捲動合併多批後，依發行日重排「已載入的全部」；缺 released_at 排最後 */
export function sortItemsByReleasedAt(items: RecommItem[], desc: boolean): RecommItem[] {
  return [...items].sort((a, b) => {
    const ta = releasedTs(a.values);
    const tb = releasedTs(b.values);
    if (ta == null && tb == null) return a.id.localeCompare(b.id);
    if (ta == null) return 1;
    if (tb == null) return -1;
    const c = desc ? tb - ta : ta - tb;
    if (c !== 0) return c;
    return a.id.localeCompare(b.id);
  });
}
