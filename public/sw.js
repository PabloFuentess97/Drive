/* Personal Drive – Service Worker
 * Strategy:
 *  - App shell (HTML/CSS/JS): network first, fall back to cache, fall back to /offline.html
 *  - Static assets (/_next/static, /icons): cache first, populate on first hit.
 *  - GET /api/files (listings): network first, store last response so the file
 *    list shows when offline.
 *  - File downloads (/api/files/<id>/download): network first; on failure look
 *    for the file in IndexedDB (pinned offline) – we cannot reach IDB from the
 *    SW directly without postMessage, so we just respond with a cached
 *    response if there is one.
 */

const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;
const API = `api-${VERSION}`;

const SHELL_URLS = ["/", "/drive", "/recent", "/account", "/shared", "/offline.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, STATIC, API]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json"
  );
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok && req.method === "GET") cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    if (req.mode === "navigate") {
      const offline = await caches.match("/offline.html");
      if (offline) return offline;
    }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh && fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }

  if (url.pathname.startsWith("/api/files") && !url.pathname.includes("/download")) {
    event.respondWith(networkFirst(request, API));
    return;
  }

  if (url.pathname.startsWith("/api/files/") && url.pathname.endsWith("/download")) {
    // Try network first; fall back to any cached response (e.g. shown previously).
    event.respondWith(networkFirst(request, API));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL));
    return;
  }
});

// Background sync hook (best-effort; main page also re-tries on "online").
self.addEventListener("sync", (event) => {
  if (event.tag === "drive-upload-queue") {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        clients.forEach((c) => c.postMessage({ type: "SYNC_UPLOADS" }));
      })(),
    );
  }
});
