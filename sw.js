// Service worker : permet d'ouvrir Carnet sans connexion.
// Change CACHE à chaque mise en ligne d'une nouvelle version pour forcer la mise à jour.
const PREFIX = "carnet-";
const CACHE = PREFIX + "v2";
const FILES = ["./", "index.html", "css/style.css", "js/app.js", "manifest.webmanifest",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
// Sur github.io, tous les projets d'un compte partagent la même origine :
// on ne supprime que les anciens caches de Carnet, jamais ceux des autres projets.
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Réseau d'abord (pour avoir la dernière version), cache si hors-ligne.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(cache =>
    fetch(e.request).then(res => {
      if (res.ok && res.type === "basic") cache.put(e.request, res.clone());
      return res;
    }).catch(() => cache.match(e.request).then(r => {
      if (r) return r;
      if (e.request.mode === "navigate") return cache.match("index.html");
      return Response.error();
    }))
  ));
});
