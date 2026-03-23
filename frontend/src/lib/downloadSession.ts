/** 重新整理後仍能向伺服器續查同一 job（sessionStorage，分頁關閉即清除） */

const keyFor = (slug: string) => `missav-download:${encodeURIComponent(slug)}`;

export type StoredDownload = { jobId: string; startedAt: number };

export function saveActiveDownload(slug: string, jobId: string, startedAt: number): void {
  try {
    sessionStorage.setItem(keyFor(slug), JSON.stringify({ jobId, startedAt } satisfies StoredDownload));
  } catch {
    /* private mode / quota */
  }
}

export function readActiveDownload(slug: string): StoredDownload | null {
  try {
    const raw = sessionStorage.getItem(keyFor(slug));
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredDownload;
    if (typeof v?.jobId === "string" && typeof v?.startedAt === "number") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function clearActiveDownload(slug: string): void {
  try {
    sessionStorage.removeItem(keyFor(slug));
  } catch {
    /* ignore */
  }
}
