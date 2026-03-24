import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TextSizeToggle } from './components/TextSizeToggle'
import { LibraryProvider } from './context/LibraryContext'
import { LibraryPage } from './pages/LibraryPage'
import { ReadPage } from './pages/ReadPage'
import { isBookmarked } from './utils/readerStorage'

function App() {
  const location = useLocation()
  const [navBookmarked, setNavBookmarked] = useState(false)

  const readRoute = useMemo(() => {
    const m = location.pathname.match(/^\/read\/([^/]+)\/([^/]+)$/)
    if (!m) return null
    return { bookId: decodeURIComponent(m[1]), chapterId: decodeURIComponent(m[2]) }
  }, [location.pathname])
  const isReadView = location.pathname.startsWith('/read/')

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
          <div className="app-header-actions">
            {isReadView ? <TextSizeToggle /> : null}
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
            <Route path="/" element={<LibraryPage />} />
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
