import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPost } from "../api/client";
import SiteHeader from "../components/SiteHeader";
import VideoCard, { type RecommItem } from "../components/VideoCard";
import ImportExportModal from "../components/ImportExportModal";
import {
  buildBackup,
  mergeWatchHistory,
  parseBackup,
  type ImportResult,
  type MissavBackup,
} from "../lib/backup";

type FavRow = { slug: string; title: string | null; createdAt: string };

export default function FavoritesPage() {
  const [items, setItems] = useState<FavRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

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

  /**
   * 建立備份：包含後端 favorites + localStorage watchHistory
   * items 可能為 null（載入中），此時 favorites 為空陣列。
   */
  function buildCurrentBackup(): MissavBackup {
    return buildBackup(items ?? []);
  }

  /**
   * 導入備份：
   * 1. favorites → 逐筆 POST /api/favorites（upsert）
   * 2. watchHistory → mergeWatchHistory（寫入 localStorage，slug 已存在則略過）
   */
  async function handleImport(backup: MissavBackup): Promise<ImportResult> {
    // ── favorites ──
    const existingSlugs = new Set((items ?? []).map((r) => r.slug));
    let favSuccess = 0;
    let favSkipped = 0;
    let favFailed = 0;

    for (const fav of backup.favorites) {
      try {
        await apiPost("/api/favorites", { slug: fav.slug, title: fav.title });
        if (existingSlugs.has(fav.slug)) {
          favSkipped++;
        } else {
          favSuccess++;
        }
      } catch {
        favFailed++;
      }
    }

    // ── watchHistory ──
    const wh = mergeWatchHistory(backup.watchHistory);

    // 重新載入 favorites 清單
    await load();

    return {
      favorites: { success: favSuccess, skipped: favSkipped, failed: favFailed },
      watchHistory: wh,
    };
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

        {/* 標題列 */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <h1 className="home-section-title" style={{ margin: 0 }}>
            我的最愛
          </h1>
          <button
            type="button"
            className="export-trigger-btn"
            onClick={() => setShowModal(true)}
            title="導出 / 導入備份"
          >
            ↑↓ 備份 / 還原
          </button>
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

      {showModal && (
        <ImportExportModal
          title="備份 / 還原 — 最愛 & 觀看記錄"
          backup={buildCurrentBackup()}
          onImport={handleImport}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
