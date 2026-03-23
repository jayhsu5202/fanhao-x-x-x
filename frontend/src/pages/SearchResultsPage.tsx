import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import VideoCard from "../components/VideoCard";
import { useMissavLocale } from "../context/MissavLocaleContext";
import { useInfiniteRecombeeFeed } from "../hooks/useInfiniteRecombeeFeed";
import {
  type SearchSortMode,
  parseSearchSortModeParam,
  sortItemsByReleasedAt,
} from "../lib/searchSortMode";

/** 後端 /api/search 單次上限 50 */
const SEARCH_PAGE_LIMIT = 50;

export default function SearchResultsPage() {
  const { locale } = useMissavLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const trimmed = qParam.trim();
  const hasQuery = trimmed.length > 0;
  const sortMode = parseSearchSortModeParam(searchParams.get("sort"));

  const [q, setQ] = useState(qParam);
  const [formErr, setFormErr] = useState<string | null>(null);

  const searchQueryWithSort = useCallback(
    (basePath: string) => {
      const sep = basePath.includes("?") ? "&" : "?";
      if (sortMode === "relevance") return basePath;
      return `${basePath}${sep}sort=${encodeURIComponent(sortMode)}`;
    },
    [sortMode]
  );

  const getInitialUrl = useCallback(() => {
    const base = `/api/search?query=${encodeURIComponent(trimmed)}&limit=${SEARCH_PAGE_LIMIT}`;
    return searchQueryWithSort(base);
  }, [trimmed, searchQueryWithSort]);

  const getMoreUrl = useCallback(
    ({ useNext, recommId }: { useNext: boolean; recommId: string | null }) => {
      let base = `/api/search?query=${encodeURIComponent(trimmed)}&limit=${SEARCH_PAGE_LIMIT}`;
      base = searchQueryWithSort(base);
      if (useNext && recommId) {
        return `${base}&recommId=${encodeURIComponent(recommId)}`;
      }
      return `${base}&fresh=1&_cb=${Date.now()}`;
    },
    [trimmed, searchQueryWithSort]
  );

  const { items, initialLoading, loadingMore, err, sentinelRef, feedHasMore } = useInfiniteRecombeeFeed({
    pageSize: SEARCH_PAGE_LIMIT,
    resetKey: `${locale}|${trimmed}|${sortMode}`,
    enabled: hasQuery,
    getInitialUrl,
    getMoreUrl,
    initialErrorLabel: "搜尋失敗",
    loadMoreErrorLabel: "載入更多失敗",
  });

  const displayItems = useMemo(() => {
    if (sortMode === "relevance") return items;
    return sortItemsByReleasedAt(items, sortMode === "released_desc");
  }, [items, sortMode]);

  useEffect(() => {
    setQ(qParam);
  }, [qParam]);

  function setSort(next: SearchSortMode) {
    if (!trimmed) return;
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set("q", trimmed);
      if (next === "relevance") n.delete("sort");
      else n.set("sort", next);
      return n;
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (!t) {
      setFormErr("請輸入關鍵字");
      return;
    }
    setFormErr(null);
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set("q", t);
      return n;
    });
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
          <>
            <p className="search-results-meta">
              關鍵字：<span className="search-results-keyword">{qParam.trim()}</span>
              <span className="search-results-meta-hint"> · 往下滑自動載入更多</span>
            </p>
            <div className="search-sort-bar" role="group" aria-label="搜尋結果排序">
              <span className="search-sort-bar-label" id="search-sort-label">
                排序
              </span>
              <div className="search-sort-buttons" aria-labelledby="search-sort-label">
                <button
                  type="button"
                  className={`search-sort-btn${sortMode === "relevance" ? " is-active" : ""}`}
                  aria-pressed={sortMode === "relevance"}
                  onClick={() => setSort("relevance")}
                >
                  相關度
                </button>
                <button
                  type="button"
                  className={`search-sort-btn${sortMode === "released_desc" ? " is-active" : ""}`}
                  aria-pressed={sortMode === "released_desc"}
                  onClick={() => setSort("released_desc")}
                >
                  發行：新→舊
                </button>
                <button
                  type="button"
                  className={`search-sort-btn${sortMode === "released_asc" ? " is-active" : ""}`}
                  aria-pressed={sortMode === "released_asc"}
                  onClick={() => setSort("released_asc")}
                >
                  發行：舊→新
                </button>
              </div>
              {sortMode !== "relevance" ? (
                <p className="search-sort-hint">
                  依目錄欄位 <code className="inline-code">released_at</code>；無發行日的項目排在最後。已載入的批次會合併重排。
                </p>
              ) : null}
            </div>
          </>
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

        {hasQuery && !initialLoading && displayItems.length === 0 && !err ? (
          <p className="msg-muted search-results-empty-msg">沒有符合的結果，請換個關鍵字或從首頁推薦挑選。</p>
        ) : null}

        {hasQuery && !initialLoading && displayItems.length > 0 ? (
          <>
            <div className="search-results-count" aria-live="polite">
              已顯示 {displayItems.length} 筆{loadingMore ? "（載入中…）" : ""}
            </div>
            <div className="grid-cards search-results-grid" aria-busy={loadingMore}>
              {displayItems.map((it) => (
                <VideoCard key={`${it.id}-${locale}`} item={it} showFavoriteHeart />
              ))}
              <div ref={sentinelRef} className="infinite-sentinel infinite-sentinel-footer" aria-hidden>
                {loadingMore ? <span className="infinite-loading-line">載入更多…</span> : null}
              </div>
            </div>
            {!feedHasMore ? (
              <p className="msg-muted infinite-feed-end" role="status">
                已載入全部搜尋結果
              </p>
            ) : null}
          </>
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
