/**
 * Service Worker - Workbox-powered offline support
 * 
 * Handles:
 * - Precaching of core shell
 * - Runtime caching strategies
 * - Background Sync for failed requests
 * 
 * Note: This file uses importScripts for Workbox in the service worker context.
 * Vite's injectManifest strategy will inject the precache manifest at build time.
 */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { precacheAndRoute } = workbox.precaching;
const { registerRoute } = workbox.routing;
const { NetworkFirst, StaleWhileRevalidate, CacheFirst } = workbox.strategies;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { ExpirationPlugin } = workbox.expiration;
const { BackgroundSyncPlugin } = workbox.backgroundSync;
const { setCatchHandler } = workbox.routing;

// Precaching - Vite PWA plugin will inject the manifest here at build time
precacheAndRoute(self.__WB_MANIFEST || []);

// Runtime Caching Strategies

// API requests - Network First with fallback
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
        purgeOnQuotaError: true
      })
    ]
  })
);

// JSON data - Stale While Revalidate for better performance
registerRoute(
  ({ url }) => url.pathname.endsWith('.json'),
  new StaleWhileRevalidate({
    cacheName: 'json-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60 // 24 hours
      })
    ]
  })
);

// Images - Cache First with expiration
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true
      })
    ]
  })
);

// Videos - Network First (too large to cache aggressively)
registerRoute(
  ({ request }) => request.destination === 'video',
  new NetworkFirst({
    cacheName: 'videos-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxEntries: 10, // Limit video cache size
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        purgeOnQuotaError: true
      })
    ]
  })
);

// Background Sync for failed POST/PUT/DELETE requests
const bgSyncPlugin = new BackgroundSyncPlugin('media-uploads', {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours
  onSync: async ({ queue }) => {
    let entry;
    while (entry = await queue.shiftRequest()) {
      try {
        const response = await fetch(entry.request);
        if (response.ok) {
          console.log('Background sync successful for:', entry.request.url);
          
          // Notify clients of successful sync
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_COMPLETE',
              url: entry.request.url
            });
          });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('Background sync failed for:', entry.request.url, error);
        // Re-queue for retry
        await queue.unshiftRequest(entry);
      }
    }
  }
});

// Register background sync for media uploads
// Workbox's BackgroundSyncPlugin automatically handles failed requests
registerRoute(
  ({ url, request }) => {
    return (
      (url.pathname.includes('/api/submissions') || url.pathname.includes('/api/media-uploads')) &&
      ['POST', 'PUT'].includes(request.method)
    );
  },
  new NetworkFirst({
    cacheName: 'api-uploads',
    plugins: [
      bgSyncPlugin,
      new CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
);

// Fallback for offline navigation
setCatchHandler(({ event }) => {
  switch (event.request.destination) {
    case 'document':
      return caches.match('/index.html');
    default:
      return Response.error();
  }
});

// Skip waiting and claim clients on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle install
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

