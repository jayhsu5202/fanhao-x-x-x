/**
 * Recombee SearchItems 相關度未必把「番號／slug」置頂；在伺服器端依查詢做一次穩定重排。
 * 僅重排同一批陣列順序，不改變筆數與 recommId。
 *
 * **分層（數字越小越前）**
 * 1. 番號／itemId（slug）：精確、前綴、尾碼數字對齊等
 * 2. 標籤欄：tags、genres、labels
 * 3. 內容／人員／系列／類型 slug：actresses、actors、directors、series、markers、`type`
 * 4. 標題：目錄內所有 `title*` 字串欄（與 docs/recombee-catalog-field-inventory.json 對齊，含各語系）
 *
 * 短純字母查詢（如 cus）易誤命中外文標題：對 2–4 層加不同幅度懲罰，標題最重、標籤最輕。
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

/** 與 Recombee `values` 一致：掃描所有 `title` 前綴字串欄（含 title_de、title_vi 等），避免硬編碼漏欄 */
function titleFields(v: Record<string, unknown> | undefined): string[] {
  if (!v) return [];
  const out: string[] = [];
  for (const k of Object.keys(v).sort()) {
    if (!k.startsWith("title")) continue;
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

/** 查詢為純小寫字母 2–6 字（正規化後），如 cus、ssis */
function isPureLatinLettersQuery(qN: string): boolean {
  return qN.length >= 2 && qN.length <= 6 && /^[a-z]+$/.test(qN);
}

function splitPrefixTrailingDigits(n: string): { pre: string; num: number } | null {
  const m = n.match(/^(.+)-(\d+)$/);
  if (!m) return null;
  const pre = m[1].toLowerCase();
  const num = Number.parseInt(m[2], 10);
  if (!Number.isFinite(num)) return null;
  return { pre, num };
}

function splitCompactStudioTailDigits(compact: string): { pre: string; num: number } | null {
  const m = compact.match(/^([a-z]{1,12})0*(\d{1,12})$/i);
  if (!m) return null;
  const num = Number.parseInt(m[2], 10);
  if (!Number.isFinite(num)) return null;
  return { pre: m[1].toLowerCase(), num };
}

function looksLikeProductCode(qN: string): boolean {
  return /[0-9]/.test(qN) || /[a-z]{2,}-/.test(qN);
}

/** 僅依 id／slug（番號）；100 表示未命中 */
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

  if (qN.length >= 2 && idN.startsWith(`${qN}-`)) return 7;
  if (qCompact.length >= 3 && idCompact.startsWith(qCompact) && idCompact !== qCompact) return 8;

  return 100;
}

/**
 * 在字串列表中找子字串命中；tierDirect=原文小寫包含，tierNorm=正規化後包含（較弱）
 * 回傳 0 表示無命中
 */
function softMatchTierInStrings(
  strings: string[],
  qRaw: string,
  qN: string,
  tierDirect: number,
  tierNorm: number
): number {
  const ql = qRaw.toLowerCase();
  let best = 1000;
  for (const s of strings) {
    if (s.toLowerCase().includes(ql)) best = Math.min(best, tierDirect);
    else if (normSlug(s).includes(qN)) best = Math.min(best, tierNorm);
  }
  return best === 1000 ? 0 : best;
}

function ambiguousLatinPenalty(qN: string, bucket: "tag" | "meta" | "title"): number {
  if (!isPureLatinLettersQuery(qN)) return 0;
  if (bucket === "tag") return 120;
  if (bucket === "meta") return 150;
  return 180;
}

function collectTagLikeStrings(v: Record<string, unknown> | undefined): string[] {
  if (!v) return [];
  return [
    ...listStringField(v, "tags"),
    ...listStringField(v, "genres"),
    ...listStringField(v, "labels"),
  ];
}

function collectMetaStrings(v: Record<string, unknown> | undefined): string[] {
  if (!v) return [];
  const typeStr = v.type;
  const typeOne =
    typeof typeStr === "string" && typeStr.trim() ? [typeStr] : ([] as string[]);
  return [
    ...listStringField(v, "actresses"),
    ...listStringField(v, "actors"),
    ...listStringField(v, "directors"),
    ...listStringField(v, "series"),
    ...listStringField(v, "markers"),
    ...typeOne,
  ];
}

/**
 * 分數越小越靠前（同分依原本索引穩定排序）
 * 0–8：番號／id；20±：標籤；40±：人員／系列；58±：標題；100：無命中
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

  const tagT = softMatchTierInStrings(collectTagLikeStrings(values), qRaw, qN, 20, 24);
  const metaT = softMatchTierInStrings(collectMetaStrings(values), qRaw, qN, 40, 44);
  const titleT = softMatchTierInStrings(titleFields(values), qRaw, qN, 58, 62);

  let best = 1000;
  if (tagT > 0) best = Math.min(best, tagT + ambiguousLatinPenalty(qN, "tag"));
  if (metaT > 0) best = Math.min(best, metaT + ambiguousLatinPenalty(qN, "meta"));
  if (titleT > 0) best = Math.min(best, titleT + ambiguousLatinPenalty(qN, "title"));

  if (best === 1000) return 100;
  return best;
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
