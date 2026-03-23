import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiGet } from "../api/client";
import SiteHeader from "../components/SiteHeader";
import VideoCard, { type RecommItem } from "../components/VideoCard";
import { useMissavLocale } from "../context/MissavLocaleContext";

type SearchRes = { recomms: RecommItem[] };

const SEARCH_LIMIT = 40;

export default function SearchResultsPage() {
  const { locale } = useMissavLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") ?? "";

  const [q, setQ] = useState(qParam);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RecommItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const runSearch = useCallback(async (query: string) => {
    const t = query.trim();
    if (!t) {
      setErr(null);
      setItems(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    setItems(null);
    try {
      const data = await apiGet<SearchRes>(
        `/api/search?query=${encodeURIComponent(t)}&limit=${SEARCH_LIMIT}`
      );
      setItems(data.recomms ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "搜尋失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setQ(qParam);
  }, [qParam]);

  useEffect(() => {
    const t = qParam.trim();
    if (!t) {
      setItems(null);
      setErr(null);
      setLoading(false);
      return;
    }
    void runSearch(t);
  }, [qParam, locale, runSearch]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (!t) {
      setErr("請輸入關鍵字");
      return;
    }
    setErr(null);
    setSearchParams({ q: t });
  }

  const hasQuery = qParam.trim().length > 0;

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
            關鍵字：<span className="search-results-keyword">{qParam}</span>
            <span className="search-results-meta-hint"> · 最多顯示 {SEARCH_LIMIT} 筆</span>
          </p>
        ) : (
          <p className="search-results-meta search-results-meta--muted">輸入關鍵字後搜尋，或從首頁與選單進入。</p>
        )}
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

        {hasQuery && loading ? (
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

        {hasQuery && !loading && items && items.length === 0 ? (
          <p className="msg-muted search-results-empty-msg">沒有符合的結果，請換個關鍵字或從首頁推薦挑選。</p>
        ) : null}

        {hasQuery && !loading && items && items.length > 0 ? (
          <>
            <div className="search-results-count" aria-live="polite">
              共 {items.length} 筆結果
            </div>
            <div className="grid-cards search-results-grid">
              {items.map((it) => (
                <VideoCard key={`${it.id}-${locale}`} item={it} />
              ))}
            </div>
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
