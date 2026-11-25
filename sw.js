/* Retires the old Yatra Portal service worker.
   Browsers that visited the previous app at this address still run its worker, which
   served cached copies of the old page. When they next load the site, the browser fetches
   this file as an update: it clears every cache, unregisters itself and reloads open tabs,
   so the EHV Diagnostic Portal is served fresh from the network. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
  })());
});
