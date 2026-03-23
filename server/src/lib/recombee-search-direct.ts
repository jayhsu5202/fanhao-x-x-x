import { recombeeGetItem } from "./recombee.js";

/**
 * 從使用者輸入推測可能與 catalog `itemId` 相同的候選（番號、fc2-ppv-…、去空白等）。
 * 僅允許安全字元，避免路徑或 Recombee 請求被注入。
 */
export function itemIdCandidatesFromSearchQuery(raw: string): string[] {
  const t = raw.trim();
  if (!t || t.length > 200) return [];
  const out: string[] = [];
  const push = (s: string) => {
    const x = s.trim();
    if (!x || x.length > 200) return;
    if (!out.includes(x)) out.push(x);
  };

  const slugLike = (s: string): boolean =>
    /^[a-zA-Z0-9][a-zA-Z0-9_.:\-]{1,127}$/.test(s) && !/\s/.test(s);

  let norm = t;
  try {
    norm = t.normalize("NFKC");
  } catch {
    /* ignore */
  }

  if (slugLike(t)) push(t);
  if (slugLike(norm) && norm !== t) push(norm);
  if (slugLike(t.toLowerCase())) push(t.toLowerCase());
  if (slugLike(norm.toLowerCase()) && norm.toLowerCase() !== t.toLowerCase()) push(norm.toLowerCase());

  const hy = t.replace(/[\s_]+/g, "-");
  if (slugLike(hy)) push(hy);
  if (slugLike(hy.toLowerCase())) push(hy.toLowerCase());

  const first = t.split(/\s+/)[0] ?? "";
  if (first.length >= 3) {
    if (slugLike(first)) push(first);
    if (slugLike(first.toLowerCase())) push(first.toLowerCase());
  }

  return out.slice(0, 8);
}

export type RecommbeeRecommShape = { id: string; values: Record<string, unknown> };

/**
 * 對候選 id 逐一 GET `/items/{id}`，存在的項目轉成與 SearchItems 相同的 `recomms` 元素形狀。
 */
export async function fetchDirectRecommsForCandidates(candidates: string[]): Promise<RecommbeeRecommShape[]> {
  const uniq = [...new Set(candidates.map((c) => c.trim()).filter(Boolean))].slice(0, 8);
  const results = await Promise.all(
    uniq.map(async (id) => {
      const values = await recombeeGetItem(id);
      if (!values) return null;
      return { id, values } as RecommbeeRecommShape;
    })
  );
  const seen = new Set<string>();
  const out: RecommbeeRecommShape[] = [];
  for (let i = 0; i < uniq.length; i++) {
    const id = uniq[i];
    const row = results[i];
    if (!row || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}
