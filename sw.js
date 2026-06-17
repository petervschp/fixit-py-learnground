/* FixIt Student Path service worker: offline shell only.
   It intentionally does NOT bundle/cache the external Pyodide CDN runtime. */
const CACHE_NAME = "fixit-student-path-v0.9-shell";

const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./storage.js",
  "./py-worker.js",
  "./style.css",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./student_routes.json",
  "./src/utils.js",
  "./src/problem-loader.js",
  "./src/runner-client.js",
  "./src/test-engine.js",
  "./src/diagnostics.js",
  "./src/diagnostic-hints.js",
  "./src/microdefense.js",
  "./src/map-ui.js",
  "./src/export-backup.js",
  "./src/routes-renderer.js",
  "./src/problem-navigation.js",
  "./src/task-header-context-panel.js",
  "./src/editor-panel.js",
  "./src/predict-fix-panel.js",
  "./src/test-action-handlers.js",
  "./src/task-renderer.js",
  "./src/runtime-status.js",
  "./src/pwa-offline.js",
  "./src/pyodide-config.js",
  "./problems/level-01.json",
  "./problems/level-02.json",
  "./problems/level-03.json",
  "./problems/level-04.json",
  "./problems/level-05.json",
  "./problems/level-06.json",
  "./problems/level-06-template.json",
  "./problems/level-07.json"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith("fixit-student-path-") && name !== CACHE_NAME)
      .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // External resources such as Pyodide CDN are intentionally network-only unless PYODIDE_BASE_URL points to a same-origin/local runtime path in v0.9.
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(navigationFallback(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function navigationFallback(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put("./index.html", fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    const cached = await caches.match("./index.html");
    if (cached) return cached;
    return new Response("FixIt offline shell nie je ešte pripravený. Najprv appku raz otvor online.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  const cache = await caches.open(CACHE_NAME);
  cache.put(req, fresh.clone()).catch(() => {});
  return fresh;
}
