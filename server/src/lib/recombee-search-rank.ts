/**
 * Recombee SearchItems 相關度未必把「番號／slug」置頂；在伺服器端依查詢做一次穩定重排。
 * 僅重排同一批陣列順序，不改變筆數與 recommId。
 *
 * 番號常見：CUS-123、CUS-00123、fc2-ppv-4867426；需處理連字號、前導零、大小寫、尾段數字比對。
 */

function normSlug(s: string): string {
  let t = s.trim();
  try {
    t = t.normalize("NFKC");
  } catch {
    /* ignore */
  }
  return t
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
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

/** 最後一段為純數字時，拆成「前面整段（小寫）」+ 數值（前導零無視） */
function splitPrefixTrailingDigits(n: string): { pre: string; num: number } | null {
  const m = n.match(/^(.+)-(\d+)$/);
  if (!m) return null;
  const pre = m[1].toLowerCase();
  const num = Number.parseInt(m[2], 10);
  if (!Number.isFinite(num)) return null;
  return { pre, num };
}

/** 無連字號的 slug：cus00123、md010（前綴字母 + 尾數，前導零忽略） */
function splitCompactStudioTailDigits(compact: string): { pre: string; num: number } | null {
  const m = compact.match(/^([a-z]{1,12})0*(\d{1,12})$/i);
  if (!m) return null;
  const num = Number.parseInt(m[2], 10);
  if (!Number.isFinite(num)) return null;
  return { pre: m[1].toLowerCase(), num };
}

/** 查詢是否像番號（含數字或連字號），子字串匹配可放寬 */
function looksLikeProductCode(qN: string): boolean {
  return /[0-9]/.test(qN) || /[a-z]{2,}-/.test(qN);
}

/**
 * 分數越小越靠前（同分依原本索引穩定排序）
 * 0–9：id／番號強相關；20+：標題；100：其餘
 */
function rankTier(query: string, id: string, values: Record<string, unknown> | undefined): number {
  const qRaw = query.trim();
  if (!qRaw) return 500;

  const idN = normSlug(id);
  const qN = normSlug(qRaw);
  if (!qN || !idN) return 500;

  const qCompact = qN.replace(/-/g, "");
  const idCompact = idN.replace(/-/g, "");

  // 0：slug 完全一致
  if (idN === qN) return 0;

  // 1：前綴 + 尾碼數字相同（CUS-123 ≡ cus-00123；fc2-ppv-1 ≡ fc2-ppv-00001）
  const idP = splitPrefixTrailingDigits(idN);
  const qP = splitPrefixTrailingDigits(qN);
  if (idP && qP && idP.num === qP.num) {
    if (idP.pre === qP.pre) return 1;
    if (idP.pre.endsWith(`-${qP.pre}`)) return 2;
  }

  // 1b：查詢為「前綴-數字」、id 為緊湊寫法 cus00123 ↔ cus-123
  const idC = splitCompactStudioTailDigits(idCompact);
  if (idC && qP && idC.pre === qP.pre && idC.num === qP.num) return 1;
  const qC = splitCompactStudioTailDigits(qCompact);
  if (qC && idP && qC.pre === idP.pre && qC.num === idP.num) return 1;
  if (idC && qC && idC.pre === qC.pre && idC.num === qC.num) return 1;

  // 2：去掉連字號後整段相同（MIDV00123 vs midv-00123）
  if (qCompact.length >= 3 && idCompact === qCompact) return 3;

  // 3：id 含完整查詢子字串（CUS-番號整段命中）
  if (qN.length >= 4 && idN.includes(qN)) return 4;
  if (looksLikeProductCode(qN) && qN.length >= 3 && idN.includes(qN)) return 5;

  // 4：查詢以 - 結尾（如 cus-）→ id 以該前綴開頭
  if (qN.length >= 3 && qN.endsWith("-")) {
    const stub = qN.replace(/-+$/, "");
    if (stub.length >= 2 && (idN === stub || idN.startsWith(`${stub}-`))) return 6;
  }

  // 5：slug 前綴（番號開頭一致）
  if (qN.length >= 3 && idN.startsWith(`${qN}-`)) return 7;
  if (qCompact.length >= 3 && idCompact.startsWith(qCompact) && idCompact !== qCompact) return 8;

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
    const rid = (r as { id?: unknown }).id;
    if (typeof rid !== "string" || !rid) return { r, i, tier: 900 };
    const rawV = (r as { values?: unknown }).values;
    const values =
      rawV && typeof rawV === "object" && !Array.isArray(rawV) ? (rawV as Record<string, unknown>) : undefined;
    return { r, i, tier: rankTier(query, rid, values) };
  });
  scored.sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.i - b.i));
  return scored.map((x) => x.r);
}
