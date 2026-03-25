import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import VideoCard, { type RecommItem } from "../components/VideoCard";
import ImportExportModal, { type ImportResult } from "../components/ImportExportModal";
import {
  clearWatchHistory,
  getWatchHistory,
  recordWatch,
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

/** 解析導入文字 → [{slug, title}] */
function parseImportLines(raw: string): { slug: string; title: string | null }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tabIdx = line.indexOf("\t");
      if (tabIdx > 0) {
        return { slug: line.slice(0, tabIdx).trim(), title: line.slice(tabIdx + 1).trim() || null };
      }
      return { slug: line, title: null };
    })
    .filter(
      (r) => r.slug.length > 0 && r.slug.length < 512 && !r.slug.includes("..") && !r.slug.includes("/")
    );
}

export default function WatchHistoryPage() {
  const [items, setItems] = useState<WatchEntry[]>([]);
  const [showModal, setShowModal] = useState(false);

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

  /** 導出文字：每行 slug<tab>title，由新到舊 */
  function buildExportText(): string {
    if (items.length === 0) return "";
    return items
      .map((r) => (r.title ? `${r.slug}\t${r.title}` : r.slug))
      .join("\n");
  }

  /** 導入：寫入 localStorage，已存在則跳過（保留原 watchedAt） */
  async function handleImport(raw: string): Promise<ImportResult> {
    const lines = parseImportLines(raw);
    const existing = new Set(items.map((r) => r.slug));
    let success = 0;
    let skipped = 0;
    const failed = 0;

    for (const { slug, title } of lines) {
      if (existing.has(slug)) {
        skipped++;
      } else {
        // 以「很久以前」的時間戳記錄，不覆蓋最近記錄
        recordWatch(slug, title);
        success++;
      }
    }

    reload();
    return { success, failed, skipped };
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
          {/* 導出/導入按鈕：marginLeft auto 推到右側，清除按鈕在其右邊 */}
          <button
            type="button"
            className="export-trigger-btn"
            style={{ marginLeft: "auto" }}
            onClick={() => setShowModal(true)}
            title="導出 / 導入觀看記錄"
          >
            ↑↓ 導出 / 導入
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
          title="觀看記錄 — 導出 / 導入"
          exportText={buildExportText()}
          onImport={handleImport}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
