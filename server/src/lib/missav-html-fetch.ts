import { spawn } from "node:child_process";
import path from "node:path";
import { config } from "../config.js";
import { MISSAV_HEADERS } from "./missav-page.js";
import { upstreamFetch } from "./upstream-fetch.js";

const scriptPath = path.join(config.projectRoot, "scripts", "fetch_missav_html.py");

/**
 * 優先以 Node（undici）抓取 MissAV 影片頁；若 403／失敗再回退 Python + missav_api（與函式庫 session 一致）。
 * 設環境變數 MISSAV_HTML_PYTHON_ONLY=1 可強制只用 Python。
 */
export async function fetchMissavHtml(pageUrl: string, acceptLanguage?: string): Promise<string> {
  if (process.env.MISSAV_HTML_PYTHON_ONLY === "1") {
    return fetchMissavHtmlViaPython(pageUrl);
  }

  const headers = acceptLanguage
    ? { ...MISSAV_HEADERS, "Accept-Language": acceptLanguage }
    : { ...MISSAV_HEADERS };

  try {
    const res = await upstreamFetch(pageUrl, {
      headers,
      signal: AbortSignal.timeout(22_000),
      redirect: "follow",
    });
    if (res.ok) {
      const text = await res.text();
      if (text.length > 1500 && text.includes("<!DOCTYPE html>")) {
        return text;
      }
    }
  } catch {
    /* fall through to Python */
  }

  return fetchMissavHtmlViaPython(pageUrl);
}

function fetchMissavHtmlViaPython(pageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.pythonPath, [scriptPath, pageUrl], {
      cwd: config.projectRoot,
      env: { ...process.env, PYTHONPATH: config.projectRoot, PYTHONUNBUFFERED: "1" },
    });
    const chunks: Buffer[] = [];
    let err = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (c: string) => {
      err += c;
    });
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString("utf8"));
        return;
      }
      reject(new Error(err.trim() || `fetch_missav_html 結束碼 ${code}`));
    });
  });
}
