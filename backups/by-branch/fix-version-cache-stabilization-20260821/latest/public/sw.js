const CACHE_PREFIX = "voto-forte-";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegação e documentos sempre vêm da rede. Nunca usamos HTML antigo
  // como fallback, evitando reabrir uma versão anterior do sistema.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(fetch(new Request(request, { cache: "no-store" })));
  }
});
