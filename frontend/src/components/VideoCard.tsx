import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { thumbnailUrlForSlug } from "../api/client";
import { useMissavLocale } from "../context/MissavLocaleContext";

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

export default function VideoCard({
  item,
  /** 預設 eager：列表縮圖盡早併發請求 /api/thumbnail；僅在極長清單可改 lazy */
  thumbLoading = "eager",
}: {
  item: RecommItem;
  thumbLoading?: "eager" | "lazy";
}) {
  const { locale } = useMissavLocale();
  const vals = item.values;
  const title = pickTitle(vals, item.id);
  const thumbSrc = thumbnailUrlForSlug(item.id, locale);
  const [thumbOk, setThumbOk] = useState(true);

  useEffect(() => {
    setThumbOk(true);
  }, [locale, item.id]);

  return (
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
        <span className="card-play" aria-hidden>
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.35)" />
            <path d="M20 16L34 24L20 32V16Z" fill="white" />
          </svg>
        </span>
      </div>
      <div className="card-body">
        <div className="slug">{item.id}</div>
        <p className="title">{title}</p>
      </div>
    </Link>
  );
}
