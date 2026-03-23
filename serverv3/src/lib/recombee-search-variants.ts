/**
 * Recombee SearchItems 對「番號、空白、大小寫」等輸入敏感；首包零結果時依序換變體再搜，
 * 不影響帶 recommId 的後續頁（仍走 RecommendNextItems）。
 */
export function searchVariantsForRecall(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const out: string[] = [];
  const push = (s: string) => {
    const x = s.trim();
    if (x.length === 0) return;
    if (!out.includes(x)) out.push(x);
  };

  let norm = t;
  try {
    norm = t.normalize("NFKC");
  } catch {
    /* ignore */
  }

  push(t);
  push(norm);
  push(t.toLowerCase());
  push(norm.toLowerCase());
  push(t.replace(/\s+/g, " ").trim());
  push(norm.replace(/\s+/g, " ").trim());
  push(t.replace(/[\s_]+/g, "-"));
  push(t.replace(/[\s_]+/g, "-").toLowerCase());
  push(t.replace(/\s+/g, ""));
  push(t.replace(/\s+/g, "").toLowerCase());

  return out;
}

/**
 * 如 CUS、SSIS、FC2（2–8 字、英數），另以「前綴-」補搜一次，提高 `cus-001` 類 slug 召回。
 * 不影響中文關鍵字或含空白之查詢。
 */
export function shouldMergeHyphenStudioSearch(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 2 || t.length > 8) return false;
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/i.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  return true;
}

export function hyphenStudioSearchQuery(raw: string): string {
  let base = raw.trim();
  try {
    base = base.normalize("NFKC");
  } catch {
    /* ignore */
  }
  base = base.toLowerCase().replace(/[\s_]+/g, "").replace(/-+$/, "");
  return `${base}-`;
}
