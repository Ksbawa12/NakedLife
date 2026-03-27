import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TextSizeToggle } from './components/TextSizeToggle'
import { ThemeToggle } from './components/ThemeToggle'
import { LibraryProvider } from './context/LibraryContext'
import { LibraryPage } from './pages/LibraryPage'
import { NotesPage } from './pages/NotesPage'
import { PhotosPage } from './pages/PhotosPage'
import { ReadPage } from './pages/ReadPage'
import { isBookmarked } from './utils/readerStorage'

function App() {
  const location = useLocation()
  const [navBookmarked, setNavBookmarked] = useState(false)
  const [libraryQuery, setLibraryQuery] = useState('')
  const navSearchRef = useRef<HTMLInputElement | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const readRoute = useMemo(() => {
    const m = location.pathname.match(/^\/read\/([^/]+)\/([^/]+)$/)
    if (!m) return null
    return { bookId: decodeURIComponent(m[1]), chapterId: decodeURIComponent(m[2]) }
  }, [location.pathname])
  const isReadView = location.pathname.startsWith('/read/')
  const isLibraryView = location.pathname === '/'

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('library-recent-searches-v1')
      const parsed = raw ? (JSON.parse(raw) as unknown) : null
      if (Array.isArray(parsed)) {
        setRecentSearches(parsed.filter((x): x is string => typeof x === 'string').slice(0, 5))
      }
    } catch {
      /* ignore */
    }
  }, [])

  const pushRecentSearch = (q: string) => {
    const nextQ = q.trim()
    if (nextQ.length < 2) return
    setRecentSearches((prev) => {
      const deduped = [nextQ, ...prev.filter((x) => x.toLowerCase() !== nextQ.toLowerCase())]
      const next = deduped.slice(0, 5)
      try {
        localStorage.setItem('library-recent-searches-v1', JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const [initialTheme] = useState<'light' | 'reading' | 'dark'>(() => {
    const storedTheme = (() => {
      try {
        const v = localStorage.getItem('reader-theme')
        if (v === 'light' || v === 'reading' || v === 'dark') return v
      } catch {
        /* ignore */
      }
      return null
    })()

    const fallbackTheme: 'light' | 'reading' | 'dark' = isReadView ? 'reading' : 'light'
    const theme = storedTheme ?? fallbackTheme
    try {
      document.documentElement.dataset.theme = theme
    } catch {
      /* ignore */
    }
    return theme
  })

  useEffect(() => {
    const storedTheme = (() => {
      try {
        const v = localStorage.getItem('reader-theme')
        if (v === 'light' || v === 'reading' || v === 'dark') return v
      } catch {
        /* ignore */
      }
      return null
    })()

    const fallbackTheme: 'light' | 'reading' | 'dark' = isReadView ? 'reading' : 'light'
    document.documentElement.dataset.theme = storedTheme ?? fallbackTheme
  }, [isReadView, initialTheme])

  useEffect(() => {
    if (!readRoute) {
      setNavBookmarked(false)
      return
    }
    setNavBookmarked(isBookmarked(readRoute.bookId, readRoute.chapterId))
  }, [readRoute])

  useEffect(() => {
    if (!isLibraryView) return

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isTyping =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        Boolean(target && (target as HTMLElement).isContentEditable)

      if (e.key === '/' && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        navSearchRef.current?.focus()
        return
      }

      if (e.key === 'Escape' && libraryQuery.trim().length > 0) {
        e.preventDefault()
        setLibraryQuery('')
        navSearchRef.current?.blur()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isLibraryView, libraryQuery])

  useEffect(() => {
    const onBookmarkState = (e: Event) => {
      const custom = e as CustomEvent<{ bookId: string; chapterId: string; bookmarked: boolean }>
      if (!readRoute) return
      if (
        custom.detail?.bookId === readRoute.bookId &&
        custom.detail?.chapterId === readRoute.chapterId
      ) {
        setNavBookmarked(Boolean(custom.detail.bookmarked))
      }
    }
    window.addEventListener('reader-bookmark-state', onBookmarkState)
    return () => window.removeEventListener('reader-bookmark-state', onBookmarkState)
  }, [readRoute])

  const onToggleBookmark = () => {
    if (!readRoute) return
    window.dispatchEvent(new CustomEvent('reader-toggle-bookmark'))
  }

  const onOpenChapters = () => {
    if (!location.pathname.startsWith('/read/')) return
    window.dispatchEvent(new CustomEvent('reader-open-chapters'))
  }

  return (
    <LibraryProvider>
      <div className="app">
        <header className={isReadView ? 'app-header app-header--reader' : 'app-header'}>
          <NavBrand />
          {isLibraryView ? (
            <div className="app-header-center">
              <input
                value={libraryQuery}
                onChange={(e) => setLibraryQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') pushRecentSearch(libraryQuery)
                }}
                onBlur={() => pushRecentSearch(libraryQuery)}
                placeholder="Search books, parts, chapters..."
                className="nav-search-input"
                aria-label="Search books"
                ref={navSearchRef}
                list="library-search-suggestions"
              />
              <datalist id="library-search-suggestions">
                {recentSearches.map((q) => (
                  <option key={q} value={q} />
                ))}
              </datalist>
            </div>
          ) : null}
          <div className="app-header-actions">
            {isReadView ? <TextSizeToggle /> : null}
            <ThemeToggle />
            {!isReadView ? (
              <>
                <Link to="/notes" className="nav-notes-btn" aria-label="Open notes">
                  Notes
                </Link>
                <Link to="/photos" className="nav-notes-btn" aria-label="Open photos">
                  Photos
                </Link>
              </>
            ) : null}
            {readRoute ? (
              <button
                type="button"
                className={navBookmarked ? 'nav-bookmark-btn nav-bookmark-btn--active' : 'nav-bookmark-btn'}
                aria-label={navBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                title={navBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                onClick={onToggleBookmark}
              >
                {navBookmarked ? (
                  <svg className="bookmark-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <svg className="bookmark-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            ) : null}
            {isReadView ? (
              <button
                type="button"
                className="nav-menu-btn"
                aria-label="Open chapters menu"
                onClick={onOpenChapters}
              >
                <svg className="chapters-hamburger" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        </header>
        <div className="app-body">
          <Routes>
            <Route
              path="/"
              element={
                <LibraryPage
                  navQuery={libraryQuery}
                  onNavQueryChange={setLibraryQuery}
                />
              }
            />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/photos" element={<PhotosPage />} />
            <Route path="/read/:bookId/:chapterId" element={<ReadPage />} />
            <Route path="/read/:bookId" element={<ReadPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </LibraryProvider>
  )
}

function NavBrand() {
  return (
    <Link to="/" className="brand">
      Nudist Life
    </Link>
  )
}

export default App
