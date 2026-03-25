/**
 * 觀看記錄 — 純 localStorage，無需後端
 * 每部影片只保留最新一筆（以 slug 去重），最多存 300 筆。
 */

export type WatchEntry = {
  slug: string;
  title: string | null;
  watchedAt: number; // Unix ms
};

const STORAGE_KEY = "missav_watch_history";
const MAX_ENTRIES = 300;

function readRaw(): WatchEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as WatchEntry[];
  } catch {
    return [];
  }
}

function writeRaw(entries: WatchEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage 空間不足時靜默忽略
  }
}

/** 讀取所有記錄，由新到舊排序 */
export function getWatchHistory(): WatchEntry[] {
  return readRaw().sort((a, b) => b.watchedAt - a.watchedAt);
}

/** 記錄一次觀看（同 slug 自動更新到最新，watchedAt = now） */
export function recordWatch(slug: string, title: string | null): void {
  recordWatchAt(slug, title, Date.now());
}

/**
 * 記錄一次觀看，可自訂 watchedAt（用於備份還原）。
 * 同 slug 若已存在，以較新的 watchedAt 覆蓋。
 */
export function recordWatchAt(
  slug: string,
  title: string | null,
  watchedAt: number
): void {
  const entries = readRaw();
  const idx = entries.findIndex((e) => e.slug === slug);
  if (idx >= 0) {
    // 保留較新的時間戳
    if (watchedAt > entries[idx].watchedAt) {
      entries[idx].watchedAt = watchedAt;
      entries[idx].title = title ?? entries[idx].title;
    }
    // 移到最前（維持 by-time 排序語義）
    const [entry] = entries.splice(idx, 1);
    entries.unshift(entry);
  } else {
    entries.unshift({ slug, title, watchedAt });
  }
  if (entries.length > MAX_ENTRIES) entries.splice(MAX_ENTRIES);
  writeRaw(entries);
}

/** 移除單筆 */
export function removeWatch(slug: string): void {
  writeRaw(readRaw().filter((e) => e.slug !== slug));
}

/** 清空全部 */
export function clearWatchHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
