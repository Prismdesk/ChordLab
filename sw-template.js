/* Chordlab service worker. (The cache prefix "music-toolbox-" is the app's original name; keeping it lets updates clean up older caches.)
   Strategy: the app shell is cached on install; every built file is cached on install; page navigations go to the network first and fall back to the cached shell, so the app opens offline.
   Bump CACHE when this file's logic changes; the build stamps a version below. */
const VERSION = "__BUILD_VERSION__";
const CACHE = `music-toolbox-${VERSION}`;
// The build replaces the empty list with every built file. In dev (no build) only the basics are cached.
const BUILT = [/*__PRECACHE__*/];
const SHELL = BUILT.length ? BUILT : ["./", "index.html", "manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: "reload" skips the browser's own HTTP cache, so a new release never installs stale files under fixed names.
    await Promise.all(SHELL.map(async (path) => {
      const response = await fetch(new Request(path, { cache: "reload" }));
      if (!response.ok) throw new Error("Could not cache " + path);
      await cache.put(path, response);
    }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("music-toolbox-") && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put("index.html", fresh.clone());
        return fresh;
      } catch {
        return (await caches.match("index.html")) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
