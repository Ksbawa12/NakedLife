const CACHE_NAME = 'nudist-life-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/library.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  const isSameOrigin = url.origin === self.location.origin
  if (!isSameOrigin) return

  // App navigation fallback for offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match('/index.html')
        return cached || Response.error()
      }),
    )
    return
  }

  // Cache-first for static assets and chapter/library files after first load.
  const isStatic =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/Stories/') ||
    url.pathname.startsWith('/books/') ||
    url.pathname === '/library.json'

  if (!isStatic) return

  event.respondWith(
    caches.match(req).then(async (cached) => {
      if (cached) return cached
      const response = await fetch(req)
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME)
        cache.put(req, response.clone())
      }
      return response
    }),
  )
})
