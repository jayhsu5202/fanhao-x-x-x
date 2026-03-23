import { Agent, fetch as undiciFetch } from "undici";
import { config } from "../config.js";
import { CHROME_LINUX_UA, buildMissavDocumentHeaders } from "./missav-headers.js";

const missavDocumentAgent = new Agent({
  allowH2: false,
  connections: Math.max(4, config.missavSessionPoolSize * 2),
  keepAliveTimeout: config.upstreamKeepAliveTimeoutMs,
  keepAliveMaxTimeout: config.upstreamKeepAliveTimeoutMs,
});

function getSetCookies(headers: Headers): string[] {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

class SimpleCookieJar {
  private readonly cookies = new Map<string, string>();

  capture(headers: Headers): void {
    for (const row of getSetCookies(headers)) {
      const first = row.split(";", 1)[0]?.trim() ?? "";
      const idx = first.indexOf("=");
      if (idx <= 0) continue;
      this.cookies.set(first.slice(0, idx), first.slice(idx + 1));
    }
  }

  headerValue(): string | null {
    if (this.cookies.size === 0) return null;
    return [...this.cookies.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

function backoffMs(attempt: number): number {
  return 300 * (attempt + 1) + Math.floor(Math.random() * 200);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

class MissavSession {
  private readonly jar = new SimpleCookieJar();
  private landingOrigin = "";
  private landingAt = 0;
  private ua = CHROME_LINUX_UA;

  private async fetch(
    url: string,
    headers: Record<string, string>
  ): Promise<Awaited<ReturnType<typeof undiciFetch>>> {
    const cookie = this.jar.headerValue();
    const res = await undiciFetch(url, {
      headers: {
        ...headers,
        ...(cookie ? { Cookie: cookie } : {}),
        "User-Agent": this.ua,
      },
      dispatcher: missavDocumentAgent,
      redirect: "follow",
      signal: AbortSignal.timeout(config.missavFetchTimeoutMs),
    } as Parameters<typeof undiciFetch>[1]);
    this.jar.capture(res.headers);
    return res;
  }

  private async ensureLanding(origin: string, acceptLanguage?: string): Promise<void> {
    const stale = Date.now() - this.landingAt > 10 * 60_000;
    if (this.landingOrigin === origin && !stale) return;
    const landing = await this.fetch(`${origin}/`, buildMissavDocumentHeaders(`${origin}/`, acceptLanguage, "landing"));
    if (!landing.ok && landing.status !== 403) {
      throw new Error(`landing HTTP ${landing.status}`);
    }
    this.landingOrigin = origin;
    this.landingAt = Date.now();
  }

  async fetchHtml(pageUrl: string, acceptLanguage?: string): Promise<string> {
    const origin = new URL(pageUrl).origin;
    let lastError = new Error("missav html fetch failed");
    for (let attempt = 0; attempt < config.missavFetchRetries; attempt++) {
      try {
        await this.ensureLanding(origin, acceptLanguage);
        const res = await this.fetch(
          pageUrl,
          buildMissavDocumentHeaders(pageUrl, acceptLanguage, "fromSite")
        );
        if (res.status === 403 || res.status === 429 || res.status >= 500) {
          lastError = new Error(`MissAV HTTP ${res.status}`);
          this.landingOrigin = "";
          if (attempt < config.missavFetchRetries - 1) {
            if (res.status === 403 && attempt >= 1) {
              this.ua = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
            }
            await sleep(backoffMs(attempt));
            continue;
          }
        }
        if (!res.ok) {
          throw new Error(`MissAV HTTP ${res.status}`);
        }
        const text = await res.text();
        if (text.length > 1500 && text.includes("<!DOCTYPE html>")) {
          return text;
        }
        lastError = new Error("MissAV returned unexpected HTML");
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
      if (attempt < config.missavFetchRetries - 1) {
        this.landingOrigin = "";
        await sleep(backoffMs(attempt));
      }
    }
    throw lastError;
  }
}

const sessionPool = Array.from({ length: config.missavSessionPoolSize }, () => new MissavSession());
let rr = 0;

export async function fetchMissavHtml(pageUrl: string, acceptLanguage?: string): Promise<string> {
  const session = sessionPool[rr++ % sessionPool.length]!;
  return session.fetchHtml(pageUrl, acceptLanguage);
}
