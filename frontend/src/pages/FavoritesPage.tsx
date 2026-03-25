import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet } from "../api/client";
import SiteHeader from "../components/SiteHeader";
import VideoCard, { type RecommItem } from "../components/VideoCard";
import ExportModal from "../components/ExportModal";

type FavRow = { slug: string; title: string | null; createdAt: string };

export default function FavoritesPage() {
  const [items, setItems] = useState<FavRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await apiGet<{ items: FavRow[] }>("/api/favorites");
      setItems(d.items ?? []);
    } catch (e) {
      setItems(null);
      setErr(e instanceof Error ? e.message : "載入失敗");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeSlug(slug: string) {
    try {
      await apiDelete(`/api/favorites/${encodeURIComponent(slug)}`);
      setItems((prev) => (prev ? prev.filter((x) => x.slug !== slug) : prev));
    } catch {
      void load();
    }
  }

  /** 產生導出文字：每行 slug（或 slug + tab + title） */
  function buildExportText(): string {
    if (!items || items.length === 0) return "";
    return items
      .map((r) => (r.title ? `${r.slug}\t${r.title}` : r.slug))
      .join("\n");
  }

  return (
    <div className="page-shell favorites-page">
      <SiteHeader />
      <main className="main-pad">
        <nav className="detail-breadcrumb" aria-label="麵包屑" style={{ marginBottom: "1rem" }}>
          <Link to="/">首頁</Link>
          <span aria-hidden> / </span>
          <span className="detail-breadcrumb-current">我的最愛</span>
        </nav>

        {/* 標題列：標題 + 導出按鈕 */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <h1 className="home-section-title" style={{ margin: 0 }}>
            我的最愛
          </h1>
          {items && items.length > 0 && (
            <button
              type="button"
              className="export-trigger-btn"
              onClick={() => setShowExport(true)}
              title="導出我的最愛清單"
            >
              ↑ 導出
            </button>
          )}
        </div>

        {err ? <p className="msg-error">{err}</p> : null}
        {items === null && !err ? (
          <div className="featured-matrix featured-matrix--home">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="featured-card-skel skeleton" />
            ))}
          </div>
        ) : null}
        {items && items.length === 0 ? (
          <p className="msg-muted">尚無項目，在影片頁或卡片上點愛心即可加入。</p>
        ) : null}
        {items && items.length > 0 ? (
          <div className="featured-matrix featured-matrix--home">
            {items.map((row) => {
              const rec: RecommItem = {
                id: row.slug,
                values: row.title ? { title: row.title } : undefined,
              };
              return (
                <div key={row.slug} className="favorites-row-slot">
                  <VideoCard
                    item={rec}
                    showFavoriteHeart
                    initialFavorited
                    onFavoriteRemoved={() => void removeSlug(row.slug)}
                  />
                  <button
                    type="button"
                    className="favorites-remove-btn"
                    onClick={() => void removeSlug(row.slug)}
                  >
                    移除
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </main>

      {showExport && (
        <ExportModal
          title="導出我的最愛"
          text={buildExportText()}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
