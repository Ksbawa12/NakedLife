import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TextSizeToggle } from './components/TextSizeToggle'
import { LibraryProvider } from './context/LibraryContext'
import { LibraryPage } from './pages/LibraryPage'
import { NotesPage } from './pages/NotesPage'
import { ReadPage } from './pages/ReadPage'
import { isBookmarked } from './utils/readerStorage'

function App() {
  const location = useLocation()
  const [navBookmarked, setNavBookmarked] = useState(false)
  const [libraryQuery, setLibraryQuery] = useState('')
  const navSearchRef = useRef<HTMLInputElement | null>(null)

  const readRoute = useMemo(() => {
    const m = location.pathname.match(/^\/read\/([^/]+)\/([^/]+)$/)
    if (!m) return null
    return { bookId: decodeURIComponent(m[1]), chapterId: decodeURIComponent(m[2]) }
  }, [location.pathname])
  const isReadView = location.pathname.startsWith('/read/')
  const isLibraryView = location.pathname === '/'

  useEffect(() => {
    document.documentElement.dataset.theme = 'reading'
  }, [])

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
        <header className="app-header">
          <NavBrand />
          {isLibraryView ? (
            <div className="app-header-center">
              <input
                value={libraryQuery}
                onChange={(e) => setLibraryQuery(e.target.value)}
                placeholder="Search books, parts, chapters..."
                className="nav-search-input"
                aria-label="Search books"
                ref={navSearchRef}
              />
            </div>
          ) : null}
          <div className="app-header-actions">
            {isReadView ? <TextSizeToggle /> : null}
            {!isReadView ? (
              <>
                <Link to="/notes" className="nav-notes-btn" aria-label="Open notes">
                  Notes
                </Link>
                <Link
                  to="/#pinned"
                  className="nav-quick-btn nav-quick-btn--mobile-hide"
                  aria-label="Jump to pinned books"
                >
                  Pinned
                </Link>
                <Link
                  to="/#bookmarks"
                  className="nav-quick-btn nav-quick-btn--mobile-hide"
                  aria-label="Jump to bookmarks"
                >
                  Bookmarks
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
            <Route path="/" element={<LibraryPage navQuery={libraryQuery} onNavQueryChange={setLibraryQuery} />} />
            <Route path="/notes" element={<NotesPage />} />
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
