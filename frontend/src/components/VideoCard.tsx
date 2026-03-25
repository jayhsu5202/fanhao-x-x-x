import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { thumbnailUrlForSlug } from "../api/client";
import { useMissavLocale } from "../context/MissavLocaleContext";
import { LIST_CHIPS_MAX, pickListChips, pickTitle } from "../lib/recombeeDisplay";
import FavoriteHeart from "./FavoriteHeart";

export type RecommItem = {
  id: string;
  values?: Record<string, unknown>;
};

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

/**
 * Recombee：`is_uncensored_leak`、`type`（如 uncensored-leak）。
 * 左下角 tab 角標用；無則不顯示。
 */
function pickUncensoredBadgeLabel(v: Record<string, unknown> | undefined): string | null {
  if (!v) return null;
  if (v.is_uncensored_leak === true) return "無碼流出";
  const typ = v.type;
  if (typeof typ !== "string" || !typ.trim()) return null;
  const t = typ.trim().toLowerCase();
  if (t.includes("uncensored-leak")) return "無碼流出";
  if (t.includes("uncensored") || t.includes("leak")) return "無碼";
  return null;
}

/**
 * 從 Recombee catalog values 取出有效的 thumbnail_url。
 * 必須是 https:// 開頭的絕對 URL，否則回傳 null（fallback 到後端代理）。
 */
function pickCatalogThumbUrl(v: Record<string, unknown> | undefined): string | null {
  if (!v) return null;
  const u = v.thumbnail_url;
  if (typeof u === "string" && u.startsWith("https://")) return u;
  return null;
}

const VideoCard = React.memo(function VideoCard({
  item,
  showFavoriteHeart = false,
  /** 在「我的最愛」列表應為 true，避免愛心顯示成未加入 */
  initialFavorited = false,
  onFavoriteRemoved,
}: {
  item: RecommItem;
  showFavoriteHeart?: boolean;
  initialFavorited?: boolean;
  onFavoriteRemoved?: () => void;
}) {
  const { locale } = useMissavLocale();
  const vals = item.values;
  const title = pickTitle(vals, item.id);
  const durationLabel = formatDurationSec(vals?.duration);
  const hasChineseSubtitle = vals?.has_chinese_subtitle === true;
  const uncensoredBadge = pickUncensoredBadgeLabel(vals);
  const chips = pickListChips(vals, LIST_CHIPS_MAX).slice(0, 2);

  /**
   * 優先使用 Recombee catalog 中的 `thumbnail_url`（直連 CDN，不走後端代理）。
   * 若 catalog 無此欄位或非 https URL，fallback 到 /api/thumbnail/:slug。
   */
  const catalogThumbUrl = pickCatalogThumbUrl(vals);
  const thumbSrc = catalogThumbUrl ?? thumbnailUrlForSlug(item.id, locale);
  const [thumbOk, setThumbOk] = useState(true);

  useEffect(() => {
    setThumbOk(true);
  }, [thumbSrc]);

  const videoTo = `/v/${encodeURIComponent(item.id)}`;

  return (
    <div className="card-slot-wrap">
      <div className="card">
        <Link to={videoTo} state={{ detailPeek: item }} className="card-thumb-link">
          <div className="card-thumb">
            {thumbOk ? (
              <img
                key={thumbSrc}
                src={thumbSrc}
                alt=""
                loading="eager"
                decoding="async"
                className="card-thumb-img"
                onError={() => {
                  // 若 catalog URL 失效，降級到後端代理
                  if (catalogThumbUrl && thumbSrc === catalogThumbUrl) {
                    // 強制觸發 re-render 改用 fallback URL
                    setThumbOk(false);
                  } else {
                    setThumbOk(false);
                  }
                }}
              />
            ) : catalogThumbUrl ? (
              // catalog URL 失效時，降級到後端代理
              <img
                key={`fallback-${item.id}-${locale}`}
                src={thumbnailUrlForSlug(item.id, locale)}
                alt=""
                loading="eager"
                decoding="async"
                className="card-thumb-img"
                onError={() => setThumbOk(false)}
              />
            ) : null}
            <div className="card-thumb-shade" aria-hidden />
            <div className="card-thumb-badges" aria-hidden>
              {uncensoredBadge ? (
                <span className="card-meta-badge card-meta-badge-uncensored">{uncensoredBadge}</span>
              ) : null}
              <div className="card-thumb-badges-trail">
                {hasChineseSubtitle ? <span className="card-meta-badge card-meta-badge-sub">中字</span> : null}
                {durationLabel ? <span className="card-meta-badge card-meta-badge-duration">{durationLabel}</span> : null}
              </div>
            </div>
            <span className="card-play" aria-hidden>
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.35)" />
                <path d="M20 16L34 24L20 32V16Z" fill="white" />
              </svg>
            </span>
          </div>
        </Link>
        <div className="card-body">
          <Link to={videoTo} state={{ detailPeek: item }} className="card-title-link">
            <p className="title" title={title}>
              {title}
            </p>
          </Link>
          <div className="card-meta-row">
            <Link to={videoTo} state={{ detailPeek: item }} className="card-slug-link">
              <div className="slug">{item.id}</div>
            </Link>
            <div className={`card-chip-row${chips.length === 0 ? " card-chip-row--empty" : ""}`} aria-hidden={chips.length === 0}>
              {chips.map((c, i) => (
                <Link
                  key={`${i}-${c}`}
                  to={`/search?q=${encodeURIComponent(c)}`}
                  className="card-chip card-chip-link"
                  title={`搜尋：${c}`}
                >
                  {c}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
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
});

export default VideoCard;
