/**
 * Recombee ReQL：與目錄 `values` 欄位對齊（見 docs/RECOMBEE_CATALOG_FIELDS.md）。
 * 用於「篩選子集 + 趨勢／全文」以提升召回，取代僅依賴單一關鍵字搜尋。
 */

/** 無碼流出旗標或 type slug */
export const RECOMBEE_FILTER_UNCENSORED = `'is_uncensored_leak' == true or 'type' == "uncensored-leak"`;

/** 素人題材：genres／tags 集合含「素人」 */
export const RECOMBEE_FILTER_AMATEUR = `("素人" in 'genres') or ("素人" in 'tags')`;

/** 亞洲／麻豆主題：標題欄位含麻豆（catalog 常見於 title_zh） */
export const RECOMBEE_FILTER_MADOU =
  `("麻豆" in 'title_zh') or ("麻豆傳媒" in 'title_zh') or ("麻豆" in 'title') or ("麻豆" in 'title_cn')`;

