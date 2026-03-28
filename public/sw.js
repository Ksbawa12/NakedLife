const CACHE_NAME = 'nudist-life-v4'
/** Only shell assets — never cache dynamic manifests here (stale library on phones). */
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

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

  // Always fresh — do not cache (fixes deleted books / old lists on mobile PWA).
  if (url.pathname === '/library.json' || url.pathname === '/photos.json') {
    event.respondWith(fetch(req, { cache: 'no-store' }))
    return
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match('/index.html')
        return cached || Response.error()
      }),
    )
    return
  }

  const isStatic =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/Stories/') ||
    url.pathname.startsWith('/books/') ||
    url.pathname.startsWith('/covers/')

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
