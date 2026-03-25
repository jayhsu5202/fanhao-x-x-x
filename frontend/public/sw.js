/**
 * Service Worker — App Shell 快取策略
 * - App Shell（HTML / JS / CSS）：Cache First，背景更新
 * - API 請求（/api/）：Network Only（不快取動態資料）
 * - 其餘靜態資源：Stale While Revalidate
 */

const SHELL_CACHE = 'app-shell-v1';
const STATIC_CACHE = 'static-v1';

// App Shell 資源清單（Vite build 後的入口）
const SHELL_URLS = [
  '/',
  '/index.html',
];

// ── Install：預快取 App Shell ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// ── Activate：清除舊版快取 ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 非同源 / chrome-extension 略過
  if (url.origin !== location.origin) return;

  // API 請求：Network Only（不快取）
  if (url.pathname.startsWith('/api/')) return;

  // App Shell HTML：Cache First，失敗時 fallback 到快取首頁
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        const networkFetch = fetch(request).then((res) => {
          if (res.ok) {
            caches.open(SHELL_CACHE).then((c) => c.put('/index.html', res.clone()));
          }
          return res;
        });
        return cached ? cached : networkFetch;
      })
    );
    return;
  }

  // 靜態資源：Stale While Revalidate
  event.respondWith(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        });
        return cached || networkFetch;
      })
    )
  );
});
