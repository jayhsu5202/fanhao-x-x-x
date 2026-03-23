import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import VideoCard from "../components/VideoCard";
import { useMissavLocale } from "../context/MissavLocaleContext";
import { useInfiniteRecombeeFeed } from "../hooks/useInfiniteRecombeeFeed";

const SEARCH_PAGE_LIMIT = 40;

export default function SearchResultsPage() {
  const { locale } = useMissavLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const trimmed = qParam.trim();
  const hasQuery = trimmed.length > 0;

  const [q, setQ] = useState(qParam);
  const [formErr, setFormErr] = useState<string | null>(null);

  const getInitialUrl = useCallback(
    () => `/api/search?query=${encodeURIComponent(trimmed)}&limit=${SEARCH_PAGE_LIMIT}`,
    [trimmed]
  );
  const getMoreUrl = useCallback(
    ({ useNext, recommId }: { useNext: boolean; recommId: string | null }) => {
      const base = `/api/search?query=${encodeURIComponent(trimmed)}&limit=${SEARCH_PAGE_LIMIT}`;
      if (useNext && recommId) {
        return `${base}&recommId=${encodeURIComponent(recommId)}`;
      }
      return `${base}&fresh=1&_cb=${Date.now()}`;
    },
    [trimmed]
  );

  const { items, initialLoading, loadingMore, err, sentinelRef } = useInfiniteRecombeeFeed({
    resetKey: `${locale}|${trimmed}`,
    enabled: hasQuery,
    getInitialUrl,
    getMoreUrl,
    initialErrorLabel: "搜尋失敗",
    loadMoreErrorLabel: "載入更多失敗",
  });

  useEffect(() => {
    setQ(qParam);
  }, [qParam]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (!t) {
      setFormErr("請輸入關鍵字");
      return;
    }
    setFormErr(null);
    setSearchParams({ q: t });
  }

  return (
    <div className="page-shell search-results-page">
      <SiteHeader />
      <header className="search-results-hero">
        <nav className="search-results-crumb" aria-label="麵包屑">
          <Link to="/">首頁</Link>
          <span aria-hidden> / </span>
          <span className="search-results-crumb-current">搜尋</span>
        </nav>
        <h1 className="search-results-h1">搜尋影片</h1>
        {hasQuery ? (
          <p className="search-results-meta">
            關鍵字：<span className="search-results-keyword">{qParam.trim()}</span>
            <span className="search-results-meta-hint"> · 往下滑自動載入更多</span>
          </p>
        ) : (
          <p className="search-results-meta search-results-meta--muted">輸入關鍵字後搜尋，或從首頁與選單進入。</p>
        )}
        {formErr ? <p className="msg-error search-results-form-err">{formErr}</p> : null}
        <form className="search-bar search-bar-hero search-results-form" onSubmit={onSubmit}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="番號、女優、類型、關鍵字…"
            autoComplete="off"
            aria-label="搜尋關鍵字"
            enterKeyHint="search"
          />
          <button type="submit">搜尋</button>
        </form>
      </header>

      <main className="main-pad search-results-main">
        {!hasQuery ? (
          <div className="search-results-empty">
            <p className="msg-muted search-results-empty-msg">尚未輸入搜尋關鍵字。</p>
            <Link className="search-results-back-home" to="/">
              ← 返回首頁瀏覽推薦
            </Link>
          </div>
        ) : null}

        {hasQuery && err ? <div className="msg-error">{err}</div> : null}

        {hasQuery && initialLoading ? (
          <div className="grid-cards search-results-grid">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="card">
                <div className="card-thumb skeleton" style={{ minHeight: 120 }} />
                <div className="card-body">
                  <div className="skeleton" style={{ height: 10, width: "40%" }} />
                  <div className="skeleton" style={{ height: 14, marginTop: 8, width: "100%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {hasQuery && !initialLoading && items.length === 0 && !err ? (
          <p className="msg-muted search-results-empty-msg">沒有符合的結果，請換個關鍵字或從首頁推薦挑選。</p>
        ) : null}

        {hasQuery && !initialLoading && items.length > 0 ? (
          <>
            <div className="search-results-count" aria-live="polite">
              已顯示 {items.length} 筆{loadingMore ? "（載入中…）" : ""}
            </div>
            <div className="grid-cards search-results-grid" aria-busy={loadingMore}>
              {items.map((it) => (
                <VideoCard key={`${it.id}-${locale}`} item={it} showFavoriteHeart />
              ))}
              <div ref={sentinelRef} className="infinite-sentinel" aria-hidden />
            </div>
          </>
        ) : null}

        {hasQuery && loadingMore && !initialLoading ? (
          <div className="grid-cards search-results-grid search-results-grid--more-skel" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`more-${i}`} className="card">
                <div className="card-thumb skeleton" style={{ minHeight: 120 }} />
                <div className="card-body">
                  <div className="skeleton" style={{ height: 10, width: "40%" }} />
                  <div className="skeleton" style={{ height: 14, marginTop: 8, width: "100%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <p className="footer-note">
          <Link to="/">返回首頁</Link>
          <span aria-hidden> · </span>
          僅供合法授權內容使用。
        </p>
      </main>
    </div>
  );
}
