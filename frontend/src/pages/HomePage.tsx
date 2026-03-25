import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { stableCacheKey } from "../lib/feedCache";
import SiteHeader from "../components/SiteHeader";
import VideoCard from "../components/VideoCard";
import { useMissavLocale } from "../context/MissavLocaleContext";
import { useInfiniteRecombeeFeed } from "../hooks/useInfiniteRecombeeFeed";

const PAGE_SIZE = 48;

export default function HomePage() {
  const { locale } = useMissavLocale();
  const { pathname, search } = useLocation();
  const feedCacheKey = stableCacheKey(pathname + search);
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

  const { items, initialLoading, loadingMore, err: featErr, sentinelRef, feedHasMore } = useInfiniteRecombeeFeed({
    pageSize: PAGE_SIZE,
    resetKey: locale,
    cacheKey: feedCacheKey,
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
    <div className="page-shell home-fanhao">
      <SiteHeader />
      <header className="app-header app-header-hero">
        <p className="home-kicker">分類瀏覽 · 熱門推薦</p>
        <h1 className="home-hero-title">
          搜尋任何<span className="home-hero-accent"> 日本AV</span>
        </h1>
        <div className="header-top">
          <span className="header-tag">搜尋 · 分類 · 收藏</span>
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
          先用搜尋找番號、女優或關鍵字，也可以直接從上方分類進入固定片單。熱門推薦往下滑會自動載入更多。
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
                  <VideoCard item={it} showFavoriteHeart />
                </div>
              ))}
              <div ref={sentinelRef} className="featured-infinite-sentinel infinite-sentinel-footer" aria-hidden>
                {loadingMore ? <span className="infinite-loading-line">載入更多…</span> : null}
              </div>
            </div>
          ) : null}
          {!initialLoading && items.length === 0 && !featErr ? (
            <p className="msg-muted" style={{ padding: "1rem 0" }}>
              暫無推薦項目。
            </p>
          ) : null}
          {!initialLoading && items.length > 0 && !feedHasMore ? (
            <p className="msg-muted infinite-feed-end" role="status">
              已載入全部推薦
            </p>
          ) : null}
        </section>

        <p className="footer-note">僅供合法授權內容使用。</p>
      </main>
    </div>
  );
}
