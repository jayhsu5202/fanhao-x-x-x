import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import VideoCard from "../components/VideoCard";
import { getNavCategory, getNavSubcategory, isNavCategoryKey } from "../constants/navCategories";
import { useMissavLocale } from "../context/MissavLocaleContext";
import { useInfiniteRecombeeFeed, type RecombeeFeedResponse } from "../hooks/useInfiniteRecombeeFeed";

type BrowseNavItem = {
  key: string;
  label: string;
  description: string;
};

type BrowseMetaRes = {
  category: string;
  subcategory?: string | null;
  subcategoryLabel?: string | null;
  label: string;
  description: string;
  source: "featured" | "filtered" | "search";
  searchQuery?: string;
  subcategories?: BrowseNavItem[];
  siblingSubcategories?: BrowseNavItem[];
};

type BrowseFirstPayload = BrowseMetaRes & RecombeeFeedResponse;

const CATEGORY_LIMIT = 50;

export default function CategoryPage() {
  const { locale } = useMissavLocale();
  const { category = "", subcategory: subcategoryParam = "" } = useParams<{ category: string; subcategory?: string }>();
  const [searchParams] = useSearchParams();
  const subcategory = (searchParams.get("sub") ?? subcategoryParam ?? "").trim();
  const validCategory = isNavCategoryKey(category);
  const categoryNav = validCategory ? getNavCategory(category) : undefined;
  const subcategoryNav = validCategory && subcategory ? getNavSubcategory(category, subcategory) : undefined;
  const valid = validCategory && (!subcategory || Boolean(subcategoryNav));

  const [meta, setMeta] = useState<BrowseMetaRes | null>(null);

  useEffect(() => {
    setMeta(null);
  }, [category, subcategory]);

  const onInitialResponse = useCallback((data: unknown) => {
    const d = data as BrowseFirstPayload;
    if (typeof d.label !== "string") return;
    setMeta({
      category: d.category,
      subcategory: typeof d.subcategory === "string" ? d.subcategory : null,
      subcategoryLabel: typeof d.subcategoryLabel === "string" ? d.subcategoryLabel : null,
      label: d.label,
      description: typeof d.description === "string" ? d.description : "",
      source: d.source === "search" ? "search" : d.source === "filtered" ? "filtered" : "featured",
      searchQuery: typeof d.searchQuery === "string" ? d.searchQuery : undefined,
      subcategories: Array.isArray(d.subcategories) ? d.subcategories : undefined,
      siblingSubcategories: Array.isArray(d.siblingSubcategories) ? d.siblingSubcategories : undefined,
    });
  }, []);

  const getInitialUrl = useCallback(() => {
    const path = subcategory
      ? `/api/browse/${encodeURIComponent(category)}/${encodeURIComponent(subcategory)}`
      : `/api/browse/${encodeURIComponent(category)}`;
    return `${path}?limit=${CATEGORY_LIMIT}`;
  }, [category, subcategory]);

  const getMoreUrl = useCallback(
    ({ useNext, recommId }: { useNext: boolean; recommId: string | null }) => {
      const path = subcategory
        ? `/api/browse/${encodeURIComponent(category)}/${encodeURIComponent(subcategory)}`
        : `/api/browse/${encodeURIComponent(category)}`;
      const base = `${path}?limit=${CATEGORY_LIMIT}`;
      if (useNext && recommId) {
        return `${base}&recommId=${encodeURIComponent(recommId)}`;
      }
      return `${base}&fresh=1&_cb=${Date.now()}`;
    },
    [category, subcategory]
  );

  const { items, initialLoading, loadingMore, err, sentinelRef, feedHasMore } = useInfiniteRecombeeFeed({
    pageSize: CATEGORY_LIMIT,
    resetKey: `${category}|${subcategory}|${locale}`,
    enabled: valid,
    getInitialUrl,
    getMoreUrl,
    initialErrorLabel: "載入失敗",
    loadMoreErrorLabel: "載入更多失敗",
    onInitialResponse,
  });

  const currentTitle =
    meta?.subcategoryLabel ??
    meta?.label ??
    subcategoryNav?.label ??
    categoryNav?.label ??
    "";
  const currentDescription =
    meta?.description || subcategoryNav?.description || categoryNav?.description || "";
  const navItems = subcategory
    ? meta?.siblingSubcategories ?? categoryNav?.children ?? []
    : meta?.subcategories ?? categoryNav?.children ?? [];

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
          <Link to={categoryNav?.to ?? "/"}>{categoryNav?.label ?? category}</Link>
          {subcategory ? (
            <>
              <span aria-hidden> / </span>
              <span>{initialLoading && !meta ? "…" : currentTitle}</span>
            </>
          ) : null}
        </nav>

        <header className="category-hero">
          <p className="category-kicker">{subcategory ? categoryNav?.label : "分類瀏覽"}</p>
          <h1 className="category-title">{initialLoading && !meta ? "載入中…" : currentTitle}</h1>
          {currentDescription ? <p className="category-desc">{currentDescription}</p> : null}
          <p className="category-scroll-hint msg-muted">往下滑載入更多</p>
          {navItems.length > 0 ? (
            <nav className="category-submenu" aria-label={subcategory ? "同分類切換" : "此分類子選單"}>
              {navItems.map((item) => {
                const safeTo = `/c/${encodeURIComponent(category)}?sub=${encodeURIComponent(item.key)}`;
                const active = subcategory ? item.key === subcategory : false;
                return (
                  <Link
                    key={`${item.key}-${item.label}`}
                    className={`category-submenu-link${active ? " is-active" : ""}`}
                    to={safeTo}
                    title={item.description}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
          {subcategory ? (
            <p className="category-back-row">
              <Link className="back-link" to={categoryNav?.to ?? "/"}>
                ← 返回 {categoryNav?.label}
              </Link>
            </p>
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
                  <div className="skeleton" style={{ height: 18, width: "100%" }} />
                  <div className="skeleton" style={{ height: 14, width: "88%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!initialLoading && items.length === 0 && !err ? (
          <p className="msg-muted category-empty-msg">
            {subcategory ? "這個子分類暫時沒有結果，請先改看同類別的其他片單。" : "此分類暫時沒有結果，請改看其他分類。"}
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

        {!initialLoading && items.length > 0 && !feedHasMore ? (
          <p className="msg-muted infinite-feed-end" role="status">
            已載入目前片單
          </p>
        ) : null}

        <p className="footer-note">
          {subcategory && meta?.searchQuery ? (
            <>
              內容已整理成固定入口。
              <span aria-hidden> · </span>
            </>
          ) : null}
          僅供合法授權內容使用。
        </p>
      </main>
    </div>
  );
}
