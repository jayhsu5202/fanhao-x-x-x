import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api/client";
import VideoCard, { type RecommItem } from "../components/VideoCard";
import SiteHeader from "../components/SiteHeader";
import { useMissavLocale } from "../context/MissavLocaleContext";
import { isNavCategoryKey, NAV_MENU } from "../constants/navCategories";

type BrowseRes = {
  category: string;
  label: string;
  description: string;
  source: "featured" | "search";
  searchQuery?: string;
  recomms: RecommItem[];
};

export default function CategoryPage() {
  const { locale } = useMissavLocale();
  const { category = "" } = useParams<{ category: string }>();
  const [data, setData] = useState<BrowseRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const valid = isNavCategoryKey(category);
  const catMenu = valid ? NAV_MENU.find((m) => m.key === category) : undefined;

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      setData(null);
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setData(null);
    apiGet<BrowseRes>(`/api/browse/${encodeURIComponent(category)}?limit=28`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "載入失敗");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, valid, locale]);

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
          <span>{loading ? "…" : data?.label ?? category}</span>
        </nav>

        <header className="category-hero">
          <h1 className="category-title">{loading ? "載入中…" : data?.label ?? ""}</h1>
          {!loading && data ? <p className="category-desc">{data.description}</p> : null}
          {!loading && data?.source === "search" && data.searchQuery ? (
            <p className="category-tech">
              搜尋關鍵字：<code className="inline-code">{data.searchQuery}</code>
            </p>
          ) : null}
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

        {loading ? (
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

        {!loading && data && data.recomms.length === 0 ? (
          <p className="msg-muted" style={{ textAlign: "left", padding: "1rem 0" }}>
            此分類暫無結果，請改從首頁搜尋或其它分類進入。
          </p>
        ) : null}

        {!loading && data && data.recomms.length > 0 ? (
          <div className="grid-cards">
            {data.recomms.map((it) => (
              <VideoCard key={`${it.id}-${locale}`} item={it} />
            ))}
          </div>
        ) : null}

        <p className="footer-note">僅供合法授權內容使用；分類內容由推薦／搜尋引擎自動產生。</p>
      </main>
    </div>
  );
}
