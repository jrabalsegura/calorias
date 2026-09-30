// Minimal service worker: it makes the app installable and takes control
// right away. It does not cache anything yet, so every request hits the
// network as if there were no service worker.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
