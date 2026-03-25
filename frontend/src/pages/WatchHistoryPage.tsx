import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import VideoCard, { type RecommItem } from "../components/VideoCard";
import ImportExportModal from "../components/ImportExportModal";
import {
  buildBackup,
  buildWatchOnlyBackup,
  mergeWatchHistory,
  type ImportResult,
  type MissavBackup,
} from "../lib/backup";
import { apiGet, apiPost } from "../api/client";
import {
  clearWatchHistory,
  getWatchHistory,
  removeWatch,
  type WatchEntry,
} from "../lib/watchHistory";

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return "剛剛";
  if (min < 60) return `${min} 分鐘前`;
  if (hr < 24) return `${hr} 小時前`;
  if (day < 30) return `${day} 天前`;
  return new Date(ms).toLocaleDateString("zh-TW");
}

export default function WatchHistoryPage() {
  const [items, setItems] = useState<WatchEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  /**
   * 導出時需要 favorites 資料（從後端取得），
   * 由 buildCurrentBackup 懶加載並快取。
   */
  const [favCache, setFavCache] = useState<
    { slug: string; title: string | null; createdAt: string }[] | null
  >(null);

  const reload = useCallback(() => {
    setItems(getWatchHistory());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function handleRemove(slug: string) {
    removeWatch(slug);
    reload();
  }

  function handleClear() {
    if (!window.confirm("確定要清空所有觀看記錄嗎？")) return;
    clearWatchHistory();
    reload();
  }

  /**
   * 開啟 modal 時拉取後端 favorites，合入備份。
   * 若已快取則直接使用。
   */
  async function openModal() {
    if (favCache === null) {
      try {
        const d = await apiGet<{ items: { slug: string; title: string | null; createdAt: string }[] }>("/api/favorites");
        setFavCache(d.items ?? []);
      } catch {
        setFavCache([]); // 取不到就帶空陣列
      }
    }
    setShowModal(true);
  }

  /**
   * 建立完整備份：favorites（後端）+ watchHistory（localStorage）
   */
  function buildCurrentBackup(): MissavBackup {
    if (favCache === null) {
      return buildWatchOnlyBackup();
    }
    return buildBackup(favCache);
  }

  /**
   * 導入備份：
   * 1. favorites → POST /api/favorites（upsert）
   * 2. watchHistory → mergeWatchHistory（localStorage，slug 已存在略過）
   */
  async function handleImport(backup: MissavBackup): Promise<ImportResult> {
    // ── favorites ──
    const existingSlugs = new Set((favCache ?? []).map((r) => r.slug));
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
    reload();

    // 更新 favCache（使下次導出反映最新狀態）
    try {
      const d = await apiGet<{ items: { slug: string; title: string | null; createdAt: string }[] }>("/api/favorites");
      setFavCache(d.items ?? []);
    } catch { /* 靜默 */ }

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
          <span className="detail-breadcrumb-current">觀看記錄</span>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <h1 className="home-section-title" style={{ margin: 0 }}>
            觀看記錄
          </h1>
          {/* 備份/還原按鈕在清除按鈕左邊 */}
          <button
            type="button"
            className="export-trigger-btn"
            style={{ marginLeft: "auto" }}
            onClick={() => void openModal()}
            title="導出 / 導入備份"
          >
            ↑↓ 備份 / 還原
          </button>
          {items.length > 0 && (
            <button
              type="button"
              className="btn-secondary-fanhao"
              style={{ width: "auto", marginTop: 0 }}
              onClick={handleClear}
            >
              清除記錄
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="msg-muted">無觀看記錄，開啟任何影片後即會自動記錄。</p>
        ) : (
          <div className="featured-matrix featured-matrix--home">
            {items.map((row) => {
              const rec: RecommItem = {
                id: row.slug,
                values: row.title ? { title: row.title } : undefined,
              };
              return (
                <div key={row.slug} className="favorites-row-slot">
                  <VideoCard item={rec} showFavoriteHeart />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      marginTop: "0.25rem",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", opacity: 0.55 }}>
                      {formatRelativeTime(row.watchedAt)}
                    </span>
                    <button
                      type="button"
                      className="favorites-remove-btn"
                      onClick={() => handleRemove(row.slug)}
                    >
                      移除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
