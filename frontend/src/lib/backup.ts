/**
 * MissAV 備份格式 v1
 *
 * 統一格式，可在「我的最愛」與「觀看記錄」兩頁之間互相導出 / 導入。
 * 同一份 JSON 同時包含 favorites 與 watchHistory，
 * 任一頁導出的備份都能在任一頁完整還原。
 *
 * JSON 結構：
 * {
 *   "v": 1,
 *   "exportedAt": "2025-03-26T00:00:00.000Z",
 *   "favorites": [ { "slug": "...", "title": "..." | null, "createdAt": "..." } ],
 *   "watchHistory": [ { "slug": "...", "title": "..." | null, "watchedAt": 1234567890000 } ]
 * }
 */

import { getWatchHistory, type WatchEntry } from "./watchHistory";

// ─── 型別定義 ──────────────────────────────────────────────

export type BackupFavorite = {
  slug: string;
  title: string | null;
  createdAt: string; // ISO 8601
};

export type BackupWatchEntry = {
  slug: string;
  title: string | null;
  watchedAt: number; // Unix ms
};

export type MissavBackup = {
  v: 1;
  exportedAt: string;          // ISO 8601
  favorites: BackupFavorite[];
  watchHistory: BackupWatchEntry[];
};

export type ImportResult = {
  favorites: { success: number; skipped: number; failed: number };
  watchHistory: { success: number; skipped: number; failed: number };
};

// ─── 建立備份物件 ──────────────────────────────────────────

/**
 * 從後端 favorites 清單 + localStorage watchHistory 組成備份物件。
 * favorites 由呼叫方傳入（FavoritesPage / WatchHistoryPage 各自從 state 取得）。
 */
export function buildBackup(
  favItems: { slug: string; title: string | null; createdAt: string }[]
): MissavBackup {
  const watchRaw: WatchEntry[] = getWatchHistory();
  return {
    v: 1,
    exportedAt: new Date().toISOString(),
    favorites: favItems.map((r) => ({
      slug: r.slug,
      title: r.title,
      createdAt: r.createdAt,
    })),
    watchHistory: watchRaw.map((r) => ({
      slug: r.slug,
      title: r.title,
      watchedAt: r.watchedAt,
    })),
  };
}

/**
 * 當 FavoritesPage 尚未取得後端資料時（favorites = null），
 * 只帶 watchHistory 的備份（favorites 為空陣列）。
 */
export function buildWatchOnlyBackup(): MissavBackup {
  return buildBackup([]);
}

// ─── 序列化 / 反序列化 ────────────────────────────────────

export function serializeBackup(backup: MissavBackup): string {
  return JSON.stringify(backup, null, 2);
}

/**
 * 解析並驗證備份 JSON 字串。
 * 若格式不符拋出 Error。
 */
export function parseBackup(raw: string): MissavBackup {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error("無效的 JSON 格式，請確認貼上的內容完整。");
  }

  if (!obj || typeof obj !== "object") throw new Error("備份格式錯誤：根層級必須是物件。");
  const b = obj as Record<string, unknown>;

  if (b["v"] !== 1) throw new Error(`不支援的備份版本（v=${String(b["v"])}），請使用最新版本導出的備份。`);
  if (!Array.isArray(b["favorites"])) throw new Error("備份格式錯誤：缺少 favorites 陣列。");
  if (!Array.isArray(b["watchHistory"])) throw new Error("備份格式錯誤：缺少 watchHistory 陣列。");

  // 驗證 favorites
  const favorites: BackupFavorite[] = [];
  for (const item of b["favorites"] as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const slug = typeof r["slug"] === "string" ? r["slug"].trim() : "";
    if (!isValidSlug(slug)) continue;
    favorites.push({
      slug,
      title: typeof r["title"] === "string" ? r["title"] : null,
      createdAt: typeof r["createdAt"] === "string" ? r["createdAt"] : new Date().toISOString(),
    });
  }

  // 驗證 watchHistory
  const watchHistory: BackupWatchEntry[] = [];
  for (const item of b["watchHistory"] as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const slug = typeof r["slug"] === "string" ? r["slug"].trim() : "";
    if (!isValidSlug(slug)) continue;
    const watchedAt = typeof r["watchedAt"] === "number" ? r["watchedAt"] : Date.now();
    watchHistory.push({
      slug,
      title: typeof r["title"] === "string" ? r["title"] : null,
      watchedAt,
    });
  }

  return {
    v: 1,
    exportedAt: typeof b["exportedAt"] === "string" ? b["exportedAt"] : "",
    favorites,
    watchHistory,
  };
}

// ─── 合併：觀看記錄（localStorage） ───────────────────────

import { recordWatchAt } from "./watchHistory";

/**
 * 將備份中的 watchHistory 合併到 localStorage。
 * - 已存在同 slug 且 watchedAt 較新 → 跳過（保留本地較新記錄）
 * - 已存在同 slug 且 watchedAt 較舊 → 也跳過（不覆蓋本地）
 * 若要完全覆蓋，由呼叫方先 clearWatchHistory()。
 */
export function mergeWatchHistory(
  entries: BackupWatchEntry[]
): { success: number; skipped: number; failed: number } {
  const existing = getWatchHistory();
  const existingMap = new Map(existing.map((e) => [e.slug, e.watchedAt]));
  let success = 0;
  let skipped = 0;
  const failed = 0;

  for (const entry of entries) {
    if (!isValidSlug(entry.slug)) { continue; }
    if (existingMap.has(entry.slug)) {
      skipped++;
    } else {
      recordWatchAt(entry.slug, entry.title, entry.watchedAt);
      success++;
    }
  }
  return { success, skipped, failed };
}

// ─── 工具 ─────────────────────────────────────────────────

function isValidSlug(s: string): boolean {
  return s.length > 0 && s.length < 512 && !s.includes("..") && !s.includes("/");
}

/** 觸發瀏覽器下載 JSON 檔案 */
export function downloadBackupFile(backup: MissavBackup): void {
  const json = serializeBackup(backup);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `missav-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
