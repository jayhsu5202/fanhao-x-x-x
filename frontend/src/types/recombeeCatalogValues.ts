/**
 * Recombee 目錄 `recomms[].values` 可選欄位（與 docs/recombee-catalog-field-inventory.json 對齊）。
 * 實際 API 可能增刪鍵；使用時一律當 optional。
 */
export type RecombeeCatalogValues = {
  title?: string;
  title_zh?: string;
  title_cn?: string;
  title_en?: string;
  title_ja?: string;
  title_ko?: string;
  title_de?: string;
  title_fr?: string;
  title_pt?: string;
  title_th?: string;
  title_vi?: string;
  title_ms?: string;
  title_fil?: string;
  title_id?: string;
  duration?: number;
  type?: string;
  tags?: string[];
  genres?: string[];
  labels?: string[];
  markers?: string[];
  series?: string[];
  actors?: string[];
  actresses?: string[];
  actresses_count?: number;
  directors?: string[];
  released_at?: number;
  has_chinese_subtitle?: boolean;
  has_english_subtitle?: boolean;
  is_uncensored_leak?: boolean;
  dm?: number;
};
