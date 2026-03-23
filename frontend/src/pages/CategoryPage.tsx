import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import VideoCard from "../components/VideoCard";
import { useMissavLocale } from "../context/MissavLocaleContext";
import { useInfiniteRecombeeFeed, type RecombeeFeedResponse } from "../hooks/useInfiniteRecombeeFeed";
import { isNavCategoryKey, NAV_MENU } from "../constants/navCategories";

type BrowseMetaRes = {
  category: string;
  label: string;
  description: string;
  source: "featured" | "search";
  searchQuery?: string;
};

type BrowseFirstPayload = BrowseMetaRes & RecombeeFeedResponse;

const CATEGORY_LIMIT = 28;

export default function CategoryPage() {
  const { locale } = useMissavLocale();
  const { category = "" } = useParams<{ category: string }>();
  const valid = isNavCategoryKey(category);
  const catMenu = valid ? NAV_MENU.find((m) => m.key === category) : undefined;

  const [meta, setMeta] = useState<BrowseMetaRes | null>(null);

  useEffect(() => {
    setMeta(null);
  }, [category]);

  const onInitialResponse = useCallback((data: unknown) => {
    const d = data as BrowseFirstPayload;
    if (typeof d.label !== "string") return;
    setMeta({
      category: d.category,
      label: d.label,
      description: typeof d.description === "string" ? d.description : "",
      source: d.source === "search" ? "search" : "featured",
      searchQuery: d.searchQuery,
    });
  }, []);

  const getInitialUrl = useCallback(
    () => `/api/browse/${encodeURIComponent(category)}?limit=${CATEGORY_LIMIT}`,
    [category]
  );
  const getMoreUrl = useCallback(
    ({ useNext, recommId }: { useNext: boolean; recommId: string | null }) => {
      const base = `/api/browse/${encodeURIComponent(category)}?limit=${CATEGORY_LIMIT}`;
      if (useNext && recommId) {
        return `${base}&recommId=${encodeURIComponent(recommId)}`;
      }
      return `${base}&fresh=1&_cb=${Date.now()}`;
    },
    [category]
  );

  const { items, initialLoading, loadingMore, err, sentinelRef } = useInfiniteRecombeeFeed({
    resetKey: `${category}|${locale}`,
    enabled: valid,
    getInitialUrl,
    getMoreUrl,
    initialErrorLabel: "載入失敗",
    loadMoreErrorLabel: "載入更多失敗",
    onInitialResponse,
  });

  if (!valid) {
    return (
      <div className="page-shell">
        <SiteHeader />
        <main className="main-pad category-main">
          <div className="msg-error">沒有這個分類</div>
          <p className="category-foot">
            <Link className="back-link" to="/" style={{ marginBottom: 0 }}>
              ← 返回首頁
            </Link>
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="main-pad category-main">
        <nav className="category-breadcrumb" aria-label="麵包屑">
          <Link to="/">首頁</Link>
          <span aria-hidden> / </span>
          <span>{initialLoading && !meta ? "…" : meta?.label ?? category}</span>
        </nav>

        <header className="category-hero">
          <h1 className="category-title">{initialLoading && !meta ? "載入中…" : meta?.label ?? ""}</h1>
          {!initialLoading && meta ? <p className="category-desc">{meta.description}</p> : null}
          {!initialLoading && meta?.source === "search" && meta.searchQuery ? (
            <p className="category-tech">
              搜尋關鍵字：<code className="inline-code">{meta.searchQuery}</code>
            </p>
          ) : null}
          <p className="category-scroll-hint msg-muted">往下滑自動載入更多</p>
          {catMenu && catMenu.children.length > 0 ? (
            <nav className="category-submenu" aria-label="此分類子選單">
              {catMenu.children.map((ch) => (
                <Link key={`${ch.label}-${ch.to}`} className="category-submenu-link" to={ch.to}>
                  {ch.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </header>

        {err ? <div className="msg-error">{err}</div> : null}

        {initialLoading ? (
          <div className="grid-cards">
            {Array.from({ length: 8 }).map((_, i) => (
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

        {!initialLoading && items.length === 0 && !err ? (
          <p className="msg-muted" style={{ textAlign: "left", padding: "1rem 0" }}>
            此分類暫無結果，請改從首頁搜尋或其它分類進入。
          </p>
        ) : null}

        {!initialLoading && items.length > 0 ? (
          <div className="grid-cards" aria-busy={loadingMore}>
            {items.map((it) => (
              <VideoCard key={`${it.id}-${locale}`} item={it} showFavoriteHeart />
            ))}
            <div ref={sentinelRef} className="infinite-sentinel infinite-sentinel-footer" aria-hidden>
              {loadingMore ? <span className="infinite-loading-line">載入更多…</span> : null}
            </div>
          </div>
        ) : null}

        <p className="footer-note">僅供合法授權內容使用；分類內容由推薦／搜尋引擎自動產生。</p>
      </main>
    </div>
  );
}
