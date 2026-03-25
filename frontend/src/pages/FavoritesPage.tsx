import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPost } from "../api/client";
import SiteHeader from "../components/SiteHeader";
import VideoCard, { type RecommItem } from "../components/VideoCard";
import ImportExportModal, { type ImportResult } from "../components/ImportExportModal";

type FavRow = { slug: string; title: string | null; createdAt: string };

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
    .filter((r) => r.slug.length > 0 && r.slug.length < 512 && !r.slug.includes("..") && !r.slug.includes("/"));
}

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

  /** 導出文字：每行 slug<tab>title */
  function buildExportText(): string {
    if (!items || items.length === 0) return "";
    return items
      .map((r) => (r.title ? `${r.slug}\t${r.title}` : r.slug))
      .join("\n");
  }

  /** 導入：逐筆呼叫 POST /api/favorites */
  async function handleImport(raw: string): Promise<ImportResult> {
    const lines = parseImportLines(raw);
    let success = 0;
    let failed = 0;
    const skipped = 0;
    const existing = new Set((items ?? []).map((r) => r.slug));

    for (const { slug, title } of lines) {
      // 已存在的也 upsert（後端會更新 title），不算 skipped
      try {
        await apiPost("/api/favorites", { slug, title });
        if (!existing.has(slug)) success++;
        else success++; // upsert 成功
      } catch {
        failed++;
      }
    }

    // 重新載入清單
    await load();
    return { success, failed, skipped };
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

        {/* 標題列：標題 + 導出/導入按鈕 */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <h1 className="home-section-title" style={{ margin: 0 }}>
            我的最愛
          </h1>
          <button
            type="button"
            className="export-trigger-btn"
            onClick={() => setShowModal(true)}
            title="導出 / 導入我的最愛"
          >
            ↑↓ 導出 / 導入
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
          title="我的最愛 — 導出 / 導入"
          exportText={buildExportText()}
          onImport={handleImport}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
