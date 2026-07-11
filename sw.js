// Service Worker do ImóvelIA — permite instalar e usar offline.
// Estratégia: network-first (sempre tenta a internet; se falhar, usa o cache).
const CACHE = "imovelia-v2";
const SHELL = [
  "/", "/index.html", "/css/styles.css",
  "/js/icons.js", "/js/parser.js", "/js/api.js",
  "/js/video.js", "/js/feed.js", "/js/pwa.js", "/js/app.js",
  "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Não intercepta requisições da API nem métodos que não sejam GET
  if (req.method !== "GET" || req.url.includes("/api/")) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/index.html")))
  );
});
