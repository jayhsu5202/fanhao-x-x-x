import path from "node:path";

/**
 * 依番號結構分資料夾：snos-173 → SNOS/SNOS-173（與常見 JAV 廠牌-番號一致）。
 * 無法以第一個「-」切出前後兩段時，落在 _misc/{slug}。
 */
export function nestedDownloadRelDir(slug: string): string {
  const s = slug
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+/, "");
  if (!s) return path.join("_misc", "unknown");
  const i = s.indexOf("-");
  if (i > 0 && i < s.length - 1) {
    const prefix = s.slice(0, i);
    const rest = s.slice(i + 1);
    if (prefix.length > 0 && rest.length > 0 && /^[a-zA-Z0-9_]+$/.test(prefix) && /^[a-zA-Z0-9._-]+$/.test(rest)) {
      const studio = prefix.toUpperCase();
      const folderName = `${studio}-${rest}`;
      return path.join(studio, folderName);
    }
  }
  return path.join("_misc", s);
}
