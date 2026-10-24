// Minimal service worker so phones can install Emperor to the home screen.
// It does not cache app data: everything stays live from Supabase.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
