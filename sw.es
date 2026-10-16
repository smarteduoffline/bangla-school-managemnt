const CACHE_PREFIX = "bangla-school-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const APP_FILES = ["./", "./index.html", "./app.js", "./manifest.json", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache each asset independently so a missing optional file (such as an icon)
    // does not prevent the service worker from installing.
    await Promise.all(APP_FILES.map(async (file) => {
      try {
        await cache.add(file);
      } catch (error) {
        console.warn(`Could not pre-cache ${file}:`, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && response.status === 200 && response.type === "basic") {
      try {
        await cache.put(request, response.clone());
      } catch (error) {
        console.warn(`Could not cache ${request.url}:`, error);
      }
    }
    return response;
  })());
});
