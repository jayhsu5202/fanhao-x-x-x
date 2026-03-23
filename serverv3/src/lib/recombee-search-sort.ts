import { rankSearchRecommsForQuery } from "./recombee-search-rank.js";

export type SearchSortMode = "relevance" | "released_desc" | "released_asc";

export function parseSearchSortMode(raw: string | undefined): SearchSortMode {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "released_desc" || t === "date_desc" || t === "new") return "released_desc";
  if (t === "released_asc" || t === "date_asc" || t === "old") return "released_asc";
  return "relevance";
}

function releasedAtOf(row: unknown): number | null {
  if (!row || typeof row !== "object") return null;
  const v = (row as { values?: unknown }).values;
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = (v as Record<string, unknown>).released_at;
  if (typeof r === "number" && Number.isFinite(r)) return r;
  return null;
}

function idOf(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const id = (row as { id?: unknown }).id;
  return typeof id === "string" ? id : "";
}

/** 依發行時間排序；缺欄位排最後；同秒以 id 字串穩定排序 */
export function sortRecommsByReleasedAt(recomms: unknown[], desc: boolean): unknown[] {
  const arr = [...recomms];
  arr.sort((a, b) => {
    const ta = releasedAtOf(a);
    const tb = releasedAtOf(b);
    if (ta == null && tb == null) return idOf(a).localeCompare(idOf(b));
    if (ta == null) return 1;
    if (tb == null) return -1;
    const c = desc ? tb - ta : ta - tb;
    if (c !== 0) return c;
    return idOf(a).localeCompare(idOf(b));
  });
  return arr;
}

export function orderSearchRecommsForMode(query: string, deduped: unknown[], mode: SearchSortMode): unknown[] {
  if (mode === "relevance") return rankSearchRecommsForQuery(query, deduped);
  return sortRecommsByReleasedAt(deduped, mode === "released_desc");
}
