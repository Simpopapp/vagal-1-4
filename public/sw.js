/*
 * Offline shell (F7).
 *
 * Strategy:
 *   - navigations: network-first, falling back to the cached shell, so the
 *     app opens offline with lyrics and vocabulary (which live in IndexedDB);
 *   - static assets and fonts: cache-first;
 *   - never cached: /~oauth (auth callbacks must always reach the network),
 *     /api, and anything non-GET.
 */

const SHELL_CACHE = "letras-shell-v1";
const ASSET_CACHE = "letras-assets-v1";

const NEVER_CACHE = ["/~oauth", "/api"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add("/"))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (NEVER_CACHE.some((path) => url.pathname.startsWith(path))) return;

  const isFont =
    url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com";
  const isStatic =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/_assets/"));

  if (isFont || isStatic) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() =>
          caches.match("/").then(
            (hit) =>
              hit ??
              new Response("Você está offline e esta página ainda não foi visitada.", {
                status: 503,
                headers: { "content-type": "text/plain; charset=utf-8" },
              }),
          ),
        ),
    );
  }
});
