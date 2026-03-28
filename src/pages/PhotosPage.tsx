import { useEffect, useMemo, useRef, useState } from 'react'

type PhotosManifest = {
  generatedAt: number
  count: number
  items: Array<{ src: string; name: string; order?: number | null }>
}

export function PhotosPage() {
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [data, setData] = useState<PhotosManifest | null>(null)
  const [q, setQ] = useState('')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const swipeStartX = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    void (async () => {
      try {
        const res = await fetch('/photos.json', { cache: 'no-store' })
        if (!res.ok) throw new Error('missing photos.json')
        const json = (await res.json()) as PhotosManifest
        if (!cancelled) {
          setData(json)
          setStatus('ready')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const items = useMemo(() => {
    const list = data?.items ?? []
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter((it) => it.name.toLowerCase().includes(s))
  }, [data, q])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const ao = a.order ?? Number.POSITIVE_INFINITY
      const bo = b.order ?? Number.POSITIVE_INFINITY
      if (ao !== bo) return ao - bo
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
  }, [items])

  const active = activeIndex == null ? null : sortedItems[activeIndex] ?? null

  useEffect(() => {
    if (activeIndex == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveIndex(null)
        return
      }
      if (e.key === 'ArrowLeft') {
        setActiveIndex((i) => {
          if (i == null) return i
          return (i - 1 + sortedItems.length) % sortedItems.length
        })
      }
      if (e.key === 'ArrowRight') {
        setActiveIndex((i) => {
          if (i == null) return i
          return (i + 1) % sortedItems.length
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIndex, sortedItems.length])

  return (
    <main className="page library-page">
      <header className="library-header">
        <h1>Photos</h1>
        <p className="muted">A simple gallery</p>
        <div className="library-header-divider" />
        <div className="library-search">
          <input
            className="library-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by filename…"
            aria-label="Search photos"
          />
        </div>
        {status === 'ready' ? (
          <div className="library-header-meta" aria-live="polite">
            <span className="library-results-count muted small">
              {sortedItems.length === 1 ? '1 photo' : `${sortedItems.length} photos`}
            </span>
          </div>
        ) : null}
      </header>

      {status === 'loading' ? (
        <p className="muted">Loading…</p>
      ) : status === 'error' ? (
        <section className="library-section library-empty-card">
          <h2 className="library-section-title">No photos found</h2>
          <p className="library-empty muted">
            Put images in <code>public/photos/</code> and restart the dev server.
          </p>
        </section>
      ) : !items.length ? (
        <section className="library-section library-empty-card">
          <h2 className="library-section-title">No matches</h2>
          <p className="library-empty muted">Try a different search.</p>
        </section>
      ) : (
        <section className="library-section">
          <ul className="photo-grid" aria-label="Photo gallery">
            {sortedItems.map((it, idx) => (
              <li key={it.src} className="photo-card">
                <button
                  type="button"
                  className="photo-link photo-link-btn"
                  onClick={() => setActiveIndex(idx)}
                  aria-label={`Open photo ${it.name}`}
                >
                  <img className="photo-img" src={it.src} alt={it.name} loading="lazy" />
                </button>
                <div className="photo-meta muted small" title={it.name}>
                  {it.name}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {active ? (
        <div
          className="modal-backdrop photo-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setActiveIndex(null)}
        >
          <div className="photo-viewer-card" onClick={(e) => e.stopPropagation()}>
            <div className="photo-viewer-top">
              <div className="photo-viewer-title muted small">{active.name}</div>
              <button type="button" className="pref-modal-close" aria-label="Close" onClick={() => setActiveIndex(null)}>
                ×
              </button>
            </div>
            <div className="photo-viewer-body">
              <button
                type="button"
                className="read-mini-btn"
                onClick={() =>
                  setActiveIndex((i) => (i == null ? i : (i - 1 + sortedItems.length) % sortedItems.length))
                }
              >
                Previous
              </button>
              <div
                className="photo-viewer-img-wrap"
                onPointerDown={(e) => {
                  if (!e.isPrimary) return
                  e.currentTarget.setPointerCapture(e.pointerId)
                  swipeStartX.current = e.clientX
                }}
                onPointerUp={(e) => {
                  if (!e.isPrimary) return
                  const startX = swipeStartX.current
                  swipeStartX.current = null
                  if (startX == null) return
                  const delta = e.clientX - startX
                  if (Math.abs(delta) < 36) return
                  if (delta < 0) {
                    setActiveIndex((i) => (i == null ? i : (i + 1) % sortedItems.length))
                  } else {
                    setActiveIndex((i) => (i == null ? i : (i - 1 + sortedItems.length) % sortedItems.length))
                  }
                }}
                onPointerCancel={() => {
                  swipeStartX.current = null
                }}
              >
                <img className="photo-viewer-img" src={active.src} alt={active.name} draggable={false} />
              </div>
              <button
                type="button"
                className="read-mini-btn"
                onClick={() =>
                  setActiveIndex((i) => (i == null ? i : (i + 1) % sortedItems.length))
                }
              >
                Next
              </button>
            </div>
            <div className="photo-viewer-hint muted small">Tip: use ← / → keys</div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

