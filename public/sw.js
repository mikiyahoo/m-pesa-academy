// M-PESA Academy PWA Service Worker
const CACHE_NAME = 'mpesa-academy-cache-v1'
const STATIC_ASSETS = [
  '/',
  '/trainings',
  '/learning',
  '/certificates',
  '/favicon.svg',
  '/M-PESA-red-logo.svg',
  '/manifest.json'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Continue even if some individual resources fail to precache
      })
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Pass non-GET and chrome-extension requests directly to network
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return
  }

  // Vite HMR and dev server requests should bypass service worker cache
  if (
    event.request.url.includes('/@vite') ||
    event.request.url.includes('/@fs') ||
    event.request.url.includes('/src/') ||
    event.request.url.includes('hot-update')
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version while fetching fresh version in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse))
            }
          })
          .catch(() => {})
        return cachedResponse
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse
          }
          const responseToCache = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
          return networkResponse
        })
        .catch(() => {
          // If offline and request is an HTML navigation, return cached root
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/')
          }
        })
    })
  )
})
