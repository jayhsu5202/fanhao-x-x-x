import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet } from "../api/client";
import SiteHeader from "../components/SiteHeader";
import VideoCard, { type RecommItem } from "../components/VideoCard";

type FavRow = { slug: string; title: string | null; createdAt: string };

export default function FavoritesPage() {
  const [items, setItems] = useState<FavRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  return (
    <div className="page-shell favorites-page">
      <SiteHeader />
      <main className="main-pad">
        <nav className="detail-breadcrumb" aria-label="麵包屑" style={{ marginBottom: "1rem" }}>
          <Link to="/">首頁</Link>
          <span aria-hidden> / </span>
          <span className="detail-breadcrumb-current">我的最愛</span>
        </nav>
        <h1 className="home-section-title" style={{ marginBottom: "0.75rem" }}>
          我的最愛
        </h1>
        <p className="msg-muted" style={{ marginBottom: "1.25rem" }}>
          資料存在本站 SQLite，清除瀏覽器不會遺失；重灌後端資料庫則會清空。
        </p>
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
                    thumbLoading="lazy"
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
    </div>
  );
}
