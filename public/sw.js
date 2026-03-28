const CACHE_NAME = 'nudist-life-v5'
/** Only shell assets — never cache dynamic manifests here (stale library on phones). */
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

function pathLooksLikeStaticFile(pathname) {
  return /\.[a-z0-9]{1,8}$/i.test(pathname)
}

async function spaShellResponse() {
  const cached = (await caches.match('/index.html')) || (await caches.match('/'))
  if (cached) return cached
  const res = await fetch('/index.html', { cache: 'no-store', credentials: 'same-origin' })
  return res.ok ? res : Response.error()
}

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
      (async () => {
        try {
          const res = await fetch(req)
          if (res.ok) return res
          // Host returned 404/5xx for an app route — serve SPA shell (common on mobile full reload / PWA).
          if (!pathLooksLikeStaticFile(url.pathname)) {
            const shell = await spaShellResponse()
            if (shell && shell.ok) return shell
          }
          return res
        } catch {
          const shell = await spaShellResponse()
          return shell && shell.ok ? shell : Response.error()
        }
      })(),
    )
    return
  }

  const isStatic =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/Stories/') ||
    url.pathname.startsWith('/books/') ||
    url.pathname.startsWith('/covers/') ||
    url.pathname === '/brand-logo.png'

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
