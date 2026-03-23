import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import VideoCard from "../components/VideoCard";
import { useMissavLocale } from "../context/MissavLocaleContext";
import { useInfiniteRecombeeFeed } from "../hooks/useInfiniteRecombeeFeed";

const PAGE_SIZE = 32;

export default function HomePage() {
  const { locale } = useMissavLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState("");

  const getInitialUrl = useCallback(() => `/api/featured?limit=${PAGE_SIZE}`, []);
  const getMoreUrl = useCallback(
    ({ useNext, recommId }: { useNext: boolean; recommId: string | null }) => {
      if (useNext && recommId) {
        return `/api/featured?limit=${PAGE_SIZE}&recommId=${encodeURIComponent(recommId)}`;
      }
      return `/api/featured?limit=${PAGE_SIZE}&fresh=1&_cb=${Date.now()}`;
    },
    []
  );

  const { items, initialLoading, loadingMore, err: featErr, sentinelRef } = useInfiniteRecombeeFeed({
    resetKey: locale,
    getInitialUrl,
    getMoreUrl,
    initialErrorLabel: "推薦載入失敗",
    loadMoreErrorLabel: "載入更多失敗",
  });

  useEffect(() => {
    const legacy = searchParams.get("q")?.trim();
    if (legacy) {
      navigate(`/search?q=${encodeURIComponent(legacy)}`, { replace: true });
    }
  }, [searchParams, navigate]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    navigate(`/search?q=${encodeURIComponent(t)}`);
  }

  return (
    <div className="page-shell home-missav">
      <SiteHeader />
      <header className="app-header app-header-hero">
        <p className="home-kicker">免費高清 · 本站聚合瀏覽</p>
        <h1 className="home-hero-title">
          搜尋任何<span className="home-hero-accent"> 日本AV</span>
        </h1>
        <div className="header-top">
          <span className="header-tag">搜尋 · 分類 · 詳情 · 播放 · 下載</span>
        </div>
        <form className="search-bar search-bar-hero" onSubmit={onSubmit} id="search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="例子：金髮、番號、女優名…"
            autoComplete="off"
            aria-label="搜尋"
            enterKeyHint="search"
          />
          <button type="submit">搜尋</button>
        </form>
        <p className="hero-sub">
          使用上方搜尋會前往<strong> 獨立搜尋頁 </strong>顯示結果。
          <strong> 語系按鈕 </strong>影響詳情與縮圖。熱門推薦往下滑會自動載入更多。
        </p>
      </header>
      <main className="main-pad">
        <section className="home-featured" aria-labelledby="feat-title">
          <div className="home-section-head">
            <h2 id="feat-title" className="home-section-title">
              熱門推薦
            </h2>
          </div>
          {featErr ? <p className="home-featured-warn">{featErr}</p> : null}
          {initialLoading ? (
            <div className="featured-matrix featured-matrix--home">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="featured-card-skel skeleton" />
              ))}
            </div>
          ) : null}
          {!initialLoading && items.length > 0 ? (
            <div className="featured-matrix featured-matrix--home" aria-busy={loadingMore}>
              {items.map((it) => (
                <div key={`${it.id}-${locale}`} className="featured-card-slot">
                  <VideoCard item={it} thumbLoading="lazy" showFavoriteHeart />
                </div>
              ))}
              <div
                ref={sentinelRef}
                className="featured-infinite-sentinel"
                aria-hidden
              />
            </div>
          ) : null}
          {!initialLoading && items.length === 0 && !featErr ? (
            <p className="msg-muted" style={{ padding: "1rem 0" }}>
              暫無推薦項目。
            </p>
          ) : null}

          {loadingMore ? (
            <div className="featured-matrix featured-matrix--home" style={{ marginTop: 12 }} aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`more-skel-${i}`} className="featured-card-skel skeleton" />
              ))}
            </div>
          ) : null}
        </section>

        <p className="footer-note">僅供合法授權內容使用；請遵守來源站與法律規範。</p>
      </main>
    </div>
  );
}
