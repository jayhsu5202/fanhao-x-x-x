/**
 * Recombee SearchItems 相關度未必把「番號／slug」置頂；在伺服器端依查詢做一次穩定重排。
 * 僅重排同一批陣列順序，不改變筆數與 recommId。
 */

function normSlug(s: string): string {
  let t = s.trim();
  try {
    t = t.normalize("NFKC");
  } catch {
    /* ignore */
  }
  return t.replace(/[\s_]+/g, "-").toLowerCase();
}

function titleFields(v: Record<string, unknown> | undefined): string[] {
  if (!v) return [];
  const keys = ["title", "title_zh", "title_cn", "title_en", "title_ko", "title_ja"] as const;
  const out: string[] = [];
  for (const k of keys) {
    const t = v[k];
    if (typeof t === "string" && t.trim()) out.push(t);
  }
  return out;
}

/** 分數越小越靠前（同分依原本索引穩定排序） */
function rankTier(query: string, id: string, values: Record<string, unknown> | undefined): number {
  const qRaw = query.trim();
  if (!qRaw) return 500;

  const idN = normSlug(id);
  const qN = normSlug(qRaw);
  const qCompact = qN.replace(/-/g, "");
  const idCompact = idN.replace(/-/g, "");

  if (qN.length >= 2 && idN === qN) return 0;
  if (qCompact.length >= 3 && idCompact === qCompact) return 1;

  if (qN.length >= 3 && idN.startsWith(`${qN}-`)) return 2;
  if (qCompact.length >= 3 && idCompact.startsWith(qCompact) && idCompact !== qCompact) return 3;

  const ql = qRaw.toLowerCase();
  for (const tit of titleFields(values)) {
    if (tit.toLowerCase().includes(ql)) return 20;
  }
  for (const tit of titleFields(values)) {
    if (normSlug(tit).includes(qN)) return 35;
  }

  return 100;
}

export function rankSearchRecommsForQuery(query: string, recomms: unknown[]): unknown[] {
  const scored = recomms.map((r, i) => {
    if (!r || typeof r !== "object") return { r, i, tier: 900 };
    const id = (r as { id?: unknown }).id;
    if (typeof id !== "string" || !id) return { r, i, tier: 900 };
    const rawV = (r as { values?: unknown }).values;
    const values =
      rawV && typeof rawV === "object" && !Array.isArray(rawV) ? (rawV as Record<string, unknown>) : undefined;
    return { r, i, tier: rankTier(query, id, values) };
  });
  scored.sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.i - b.i));
  return scored.map((x) => x.r);
}
