// ══════════════════════════════════════════════════════════════════
// SAGA MÓVIL — Service Worker v1.0
// Desarrollado por RYEJ
// ══════════════════════════════════════════════════════════════════

const CACHE_NAME = "saga-mobile-v1.0";
const CACHE_STATIC = "saga-static-v1.0";

// Archivos a cachear para funcionamiento offline
const STATIC_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// ── INSTALL ──────────────────────────────────────────────────────
self.addEventListener("install", event => {
  console.log("[SAGA SW] Instalando Service Worker v1.0...");
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      console.log("[SAGA SW] Cacheando archivos estáticos");
      return cache.addAll(STATIC_FILES);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────
self.addEventListener("activate", event => {
  console.log("[SAGA SW] Activando Service Worker v1.0...");
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_STATIC && name !== CACHE_NAME)
          .map(name => {
            console.log("[SAGA SW] Eliminando caché antigua:", name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Para peticiones al API de Google (Apps Script) — siempre red
  if (url.hostname.includes("script.google.com")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Si falla la red, devolver respuesta vacía para no bloquear
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" }
        });
      })
    );
    return;
  }

  // Para peticiones externas — solo red
  if (!url.pathname.startsWith("/") || url.hostname !== self.location.hostname) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Estrategia: Cache First, luego red
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Actualizar caché en background
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_STATIC).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // No está en caché — ir a la red
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_STATIC).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Sin red y sin caché — página offline
        if (event.request.destination === "document") {
          return caches.match("./index.html");
        }
      });
    })
  );
});

// ── PUSH NOTIFICATIONS ─────────────────────────────────────────
self.addEventListener("push", event => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body || "Nueva notificación de SAGA",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-96.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
    actions: [
      { action: "ver", title: "Ver ticket" },
      { action: "cerrar", title: "Cerrar" }
    ]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || "SAGA", options)
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "ver") {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});

console.log("[SAGA SW] Service Worker cargado correctamente");
