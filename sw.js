/* Service worker : rend l'application utilisable sans réseau.
   À déposer à côté de index.html, à la racine du site. */
const VERSION = "pdl-v1";
const APP = ["./", "./index.html"];
const EXTERNES = [
  "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&display=swap"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(APP).catch(() => {});
    // Les ressources externes sont mises en cache en mode no-cors : leur contenu
    // n'est pas lisible ici, mais le navigateur sait les resservir hors ligne.
    await Promise.all(EXTERNES.map(u => fetch(u, { mode: "no-cors" }).then(r => c.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter(n => n !== VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const memeSite = url.origin === location.origin;
  const page = req.mode === "navigate" || (memeSite && url.pathname.endsWith(".html"));

  if (page) {
    // Réseau d'abord : la dernière version publiée prime, le cache prend le relais hors ligne.
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        const c = await caches.open(VERSION); c.put(req, r.clone()); return r;
      } catch {
        return (await caches.match(req)) || (await caches.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // Polices : cache d'abord, puis réseau.
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: false });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (memeSite || /fonts\.(googleapis|gstatic)\.com/.test(url.hostname + url.pathname)) {
        const c = await caches.open(VERSION); c.put(req, r.clone());
      }
      return r;
    } catch {
      return Response.error();
    }
  })());
});
