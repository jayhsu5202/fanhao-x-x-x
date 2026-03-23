import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { thumbnailUrlForSlug } from "../api/client";
import { useMissavLocale } from "../context/MissavLocaleContext";
import FavoriteHeart from "./FavoriteHeart";

export type RecommItem = {
  id: string;
  values?: Record<string, unknown>;
};

function pickTitle(v: Record<string, unknown> | undefined, id: string): string {
  if (!v) return id;
  const zh = v.title_zh;
  const cn = v.title_cn;
  const en = v.title_en;
  const t = v.title;
  if (typeof zh === "string" && zh) return zh;
  if (typeof cn === "string" && cn) return cn;
  if (typeof en === "string" && en) return en;
  if (typeof t === "string" && t) return t;
  return id;
}

/** Recombee catalog：實測有 `duration`（秒，number）、`tags`／`genres`（string[]）、`type`（string） */
function formatDurationSec(seconds: unknown): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Recombee `released_at`：Unix 秒（number／float） */
function formatReleasedAt(ts: unknown): string | null {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return null;
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const LIST_CHIPS_MAX = 3;

/** 列表小標：合併 tags、genres、labels（去重），不足再退回 type */
function pickListChips(v: Record<string, unknown> | undefined, max: number): string[] {
  if (!v) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const pushFrom = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const x of arr) {
      if (typeof x !== "string" || !x.trim()) continue;
      const t = x.trim();
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= max) return;
    }
  };
  pushFrom(v.tags);
  pushFrom(v.genres);
  pushFrom(v.labels);
  if (out.length > 0) return out;
  const typ = v.type;
  if (typeof typ === "string" && typ.trim()) return [typ.trim()];
  return [];
}

export default function VideoCard({
  item,
  /** 預設 eager：列表縮圖盡早併發請求 /api/thumbnail；僅在極長清單可改 lazy */
  thumbLoading = "eager",
  showFavoriteHeart = false,
  /** 在「我的最愛」列表應為 true，避免愛心顯示成未加入 */
  initialFavorited = false,
  onFavoriteRemoved,
}: {
  item: RecommItem;
  thumbLoading?: "eager" | "lazy";
  showFavoriteHeart?: boolean;
  initialFavorited?: boolean;
  onFavoriteRemoved?: () => void;
}) {
  const { locale } = useMissavLocale();
  const vals = item.values;
  const title = pickTitle(vals, item.id);
  const durationLabel = formatDurationSec(vals?.duration);
  const releasedLabel = formatReleasedAt(vals?.released_at);
  const hasChineseSubtitle = vals?.has_chinese_subtitle === true;
  const chips = pickListChips(vals, LIST_CHIPS_MAX);
  const thumbSrc = thumbnailUrlForSlug(item.id, locale);
  const [thumbOk, setThumbOk] = useState(true);

  useEffect(() => {
    setThumbOk(true);
  }, [locale, item.id]);

  return (
    <div className="card-slot-wrap">
      <Link to={`/v/${encodeURIComponent(item.id)}`} className="card card-link">
        <div className="card-thumb">
          {thumbOk ? (
            <img
              key={thumbSrc}
              src={thumbSrc}
              alt=""
              loading={thumbLoading}
              decoding="async"
              className="card-thumb-img"
              onError={() => setThumbOk(false)}
            />
          ) : null}
          <div className="card-thumb-shade" aria-hidden />
          <div className="card-thumb-badges" aria-hidden>
            {hasChineseSubtitle ? <span className="card-meta-badge card-meta-badge-sub">中字</span> : null}
            {releasedLabel ? <span className="card-meta-badge card-meta-badge-date">{releasedLabel}</span> : null}
            {durationLabel ? <span className="card-meta-badge card-meta-badge-duration">{durationLabel}</span> : null}
          </div>
          <span className="card-play" aria-hidden>
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.35)" />
              <path d="M20 16L34 24L20 32V16Z" fill="white" />
            </svg>
          </span>
        </div>
        <div className="card-body">
          <div className="slug">{item.id}</div>
          {chips.length > 0 ? (
            <div className="card-chip-row">
              {chips.map((c, i) => (
                <span key={`${i}-${c}`} className="card-chip">
                  {c}
                </span>
              ))}
            </div>
          ) : null}
          <p className="title">{title}</p>
        </div>
      </Link>
      {showFavoriteHeart ? (
        <FavoriteHeart
          className="card-favorite-heart"
          slug={item.id}
          title={title}
          initialFavorited={initialFavorited}
          onAfterChange={(f) => {
            if (!f) onFavoriteRemoved?.();
          }}
        />
      ) : null}
    </div>
  );
}
