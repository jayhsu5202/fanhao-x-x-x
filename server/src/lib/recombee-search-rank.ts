/**
 * Recombee SearchItems 相關度未必把「番號／slug」置頂；在伺服器端依查詢做一次穩定重排。
 * 僅重排同一批陣列順序，不改變筆數與 recommId。
 *
 * 番號常見：CUS-123、CUS-00123、fc2-ppv-4867426；需處理連字號、前導零、大小寫、尾段數字比對。
 * 短純字母查詢（如 CUS）易誤命中標題「Cusco」：僅文字命中時大幅降權，讓真正 cus- 開頭的 id 在前。
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

function listStringField(v: Record<string, unknown> | undefined, key: string): string[] {
  if (!v) return [];
  const arr = v[key];
  if (!Array.isArray(arr)) return [];
  return arr.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

/** 查詢為純小寫字母 2–6 字（正規化後），如 cus、ssis — 易與外文子字串誤命中 */
function isPureLatinLettersQuery(qN: string): boolean {
  return qN.length >= 2 && qN.length <= 6 && /^[a-z]+$/.test(qN);
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

/** 僅依 id／slug 給分；100 表示未命中任何 id 規則 */
function rankTierFromIdOnly(qRaw: string, idN: string, qN: string, qCompact: string, idCompact: string): number {
  if (!qN || !idN) return 100;

  if (idN === qN) return 0;

  const idP = splitPrefixTrailingDigits(idN);
  const qP = splitPrefixTrailingDigits(qN);
  if (idP && qP && idP.num === qP.num) {
    if (idP.pre === qP.pre) return 1;
    if (idP.pre.endsWith(`-${qP.pre}`)) return 2;
  }

  const idC = splitCompactStudioTailDigits(idCompact);
  if (idC && qP && idC.pre === qP.pre && idC.num === qP.num) return 1;
  const qC = splitCompactStudioTailDigits(qCompact);
  if (qC && idP && qC.pre === idP.pre && qC.num === idP.num) return 1;
  if (idC && qC && idC.pre === qC.pre && idC.num === qC.num) return 1;

  if (qCompact.length >= 3 && idCompact === qCompact) return 3;

  if (qN.length >= 4 && idN.includes(qN)) return 4;
  if (looksLikeProductCode(qN) && qN.length >= 3 && idN.includes(qN)) return 5;

  if (qN.length >= 3 && qN.endsWith("-")) {
    const stub = qN.replace(/-+$/, "");
    if (stub.length >= 2 && (idN === stub || idN.startsWith(`${stub}-`))) return 6;
  }

  /** 廠牌前綴：cus-001、md-010（至少 2 字前綴 + 連字號） */
  if (qN.length >= 2 && idN.startsWith(`${qN}-`)) return 7;
  if (qCompact.length >= 3 && idCompact.startsWith(qCompact) && idCompact !== qCompact) return 8;

  return 100;
}

/** 標題／標籤等文字是否含關鍵字；20=直接子字串，35=正規化後子字串 */
function softTextMatchTier(qRaw: string, qN: string, values: Record<string, unknown> | undefined): number {
  const ql = qRaw.toLowerCase();
  for (const tit of titleFields(values)) {
    if (tit.toLowerCase().includes(ql)) return 20;
  }
  for (const tit of titleFields(values)) {
    if (normSlug(tit).includes(qN)) return 35;
  }
  const blob = [
    ...listStringField(values, "tags"),
    ...listStringField(values, "genres"),
    ...listStringField(values, "labels"),
  ];
  for (const s of blob) {
    if (s.toLowerCase().includes(ql)) return 20;
  }
  for (const s of blob) {
    if (normSlug(s).includes(qN)) return 35;
  }
  return 0;
}

/**
 * 分數越小越靠前（同分依原本索引穩定排序）
 * 0–8：id／番號；20/35：一般文字命中；200+：純字母短查詢時的文字命中（降權）
 */
function rankTier(query: string, id: string, values: Record<string, unknown> | undefined): number {
  const qRaw = query.trim();
  if (!qRaw) return 500;

  const idN = normSlug(id);
  const qN = normSlug(qRaw);
  const qCompact = qN.replace(/-/g, "");
  const idCompact = idN.replace(/-/g, "");

  const idTier = rankTierFromIdOnly(qRaw, idN, qN, qCompact, idCompact);
  if (idTier < 100) return idTier;

  const soft = softTextMatchTier(qRaw, qN, values);
  if (soft === 0) return 100;

  if (isPureLatinLettersQuery(qN)) {
    return soft === 20 ? 200 : 215;
  }
  return soft;
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
