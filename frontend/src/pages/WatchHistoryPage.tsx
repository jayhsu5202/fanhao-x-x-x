import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import VideoCard, { type RecommItem } from "../components/VideoCard";
import ExportModal from "../components/ExportModal";
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
  const [showExport, setShowExport] = useState(false);

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

  /** 產生導出文字：每行 slug（或 slug + tab + title） */
  function buildExportText(): string {
    if (items.length === 0) return "";
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
          <span className="detail-breadcrumb-current">觀看記錄</span>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
          <h1 className="home-section-title" style={{ margin: 0 }}>
            觀看記錄
          </h1>
          {items.length > 0 && (
            <>
              {/* 導出按鈕：在清除按鈕左邊 */}
              <button
                type="button"
                className="export-trigger-btn"
                style={{ marginLeft: "auto" }}
                onClick={() => setShowExport(true)}
                title="導出觀看記錄"
              >
                ↑ 導出
              </button>
              <button
                type="button"
                className="btn-secondary-fanhao"
                style={{ width: "auto", marginTop: 0 }}
                onClick={handleClear}
              >
                清除記錄
              </button>
            </>
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

      {showExport && (
        <ExportModal
          title="導出觀看記錄"
          text={buildExportText()}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
