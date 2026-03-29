import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useLibrary } from '../context/LibraryContext'
import {
  bookChapterCount,
  firstChapter,
  hasChapter,
} from '../utils/book'
import type { Book } from '../types/library'
import {
  assignUniqueCovers,
  buildImagePool,
  DEFAULT_LIBRARY_BOOK_COVER,
  LIBRARY_CARD_COVER_PATHS,
  libraryCoverSeed,
} from '../utils/libraryCovers'
import { loadProgressMap } from '../utils/readerStorage'
type SortMode =
  | 'az'
  | 'za'
  | 'recent'
  | 'latestAdded'
  | 'oldestAdded'
  | 'mostChapters'

function BookCard({
  book,
  progressMap,
  coverSrc,
}: {
  book: Book
  progressMap: Record<string, { chapterId: string; updatedAt?: number }>
  coverSrc: string
}) {
  const to = `/read/${book.id}`
  const progress = progressMap[book.id]
  const continueTo =
    progress && hasChapter(book, progress.chapterId)
      ? `/read/${book.id}/${progress.chapterId}`
      : undefined
  const chapterCount = bookChapterCount(book)

  return (
    <article className="book-card" aria-label={book.title}>
      <div className="book-card-cover-wrap">
        <img
          className="book-card-cover"
          src={coverSrc}
          alt=""
          loading="lazy"
          draggable={false}
        />
      </div>
      <div className="book-card-body">
        <div className="book-card-text-block">
          <span className="book-card-title">{book.title}</span>
          {book.subtitle ? (
            <span className="book-card-sub muted">{book.subtitle}</span>
          ) : null}
          <span className="book-card-chapter-pill">
            {chapterCount === 1 ? '1 chapter' : `${chapterCount} chapters`}
          </span>
        </div>
        {continueTo ? (
          <span className="book-card-continue muted small">Continue where you left off</span>
        ) : null}
        <div className="book-card-actions">
          <Link className="book-card-open-link" to={to}>
            Open
          </Link>
          {continueTo ? (
            <Link className="book-card-continue-link" to={continueTo}>
              Continue
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function LibraryPage({
  navQuery,
  onNavQueryChange,
}: {
  navQuery?: string
  onNavQueryChange?: (value: string) => void
}) {
  const { state } = useLibrary()
  const [localQuery, setLocalQuery] = useState('')
  const query = navQuery ?? localQuery
  const setQuery = onNavQueryChange ?? setLocalQuery
  void setQuery
  const [sortMode, setSortMode] = useState<SortMode>('az')
  const [photoSrcs, setPhotoSrcs] = useState<string[] | null>(null)
  const progressMap = useMemo(() => loadProgressMap(), [state, query, sortMode])

  useEffect(() => {
    let cancelled = false
    fetch('/photos.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: { src?: string }[] }) => {
        if (cancelled) return
        const items = data?.items
        if (!items?.length) {
          setPhotoSrcs([])
          return
        }
        const srcs = items.map((it) => it.src).filter((s): s is string => typeof s === 'string')
        setPhotoSrcs(srcs)
      })
      .catch(() => {
        if (!cancelled) setPhotoSrcs([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const coverByBookId = useMemo(() => {
    if (state.status !== 'ready' || photoSrcs === null) return null
    const ids = state.data.books.map((b) => b.id)
    const pool = buildImagePool(LIBRARY_CARD_COVER_PATHS, photoSrcs)
    const seed = libraryCoverSeed(ids)
    return assignUniqueCovers(ids, pool, seed, DEFAULT_LIBRARY_BOOK_COVER)
  }, [state, photoSrcs])

  const compareBooks = (a: Book, b: Book) => {
    const alpha = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    if (sortMode === 'az') return alpha
    if (sortMode === 'za') return -alpha
    if (sortMode === 'latestAdded') {
      return (b.latestAddedAt ?? 0) - (a.latestAddedAt ?? 0) || alpha
    }
    if (sortMode === 'oldestAdded') {
      return (a.latestAddedAt ?? 0) - (b.latestAddedAt ?? 0) || alpha
    }
    if (sortMode === 'mostChapters') {
      return bookChapterCount(b) - bookChapterCount(a) || alpha
    }
    const aUpdated = progressMap[a.id]?.updatedAt ?? 0
    const bUpdated = progressMap[b.id]?.updatedAt ?? 0
    return bUpdated - aUpdated || alpha
  }
  const allBooks = state.status === 'ready' ? state.data.books : []
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = !q
      ? allBooks
      : allBooks.filter((b) => {
          const first = firstChapter(b)
          const hay = `${b.title} ${b.subtitle ?? ''} ${first?.title ?? ''}`.toLowerCase()
          return hay.includes(q)
        })
    return [...base].sort(compareBooks)
  }, [allBooks, query, sortMode, progressMap])

  if (state.status === 'loading') {
    return (
      <main className="page library-page">
        <p className="muted">Loading library…</p>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="page library-page">
        <p className="error">{state.message}</p>
        <p className="muted small">
          Add a valid <code>public/library.json</code> and refresh.
        </p>
      </main>
    )
  }

  const { title } = state.data
  const totalResults = filtered.length
  const hasAnyResults = totalResults > 0

  const resultsLabel = totalResults === 1 ? 'Result: 1' : `Results: ${totalResults}`

  return (
    <main className="page library-page">
      <header className="library-header">
        <h1>{title}</h1>
        <p className="muted">Pick a book and start reading</p>
        <div className="library-header-divider" />

        <div className="library-search">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="library-sort-select"
            aria-label="Sort books"
          >
            <option value="az">Sort: A-Z</option>
            <option value="za">Sort: Z-A</option>
            <option value="recent">Sort: Recently read</option>
            <option value="latestAdded">Sort: Latest added</option>
            <option value="oldestAdded">Sort: Oldest added</option>
            <option value="mostChapters">Sort: Most chapters</option>
          </select>
        </div>

        <div className="library-header-meta" aria-live="polite">
          <span className="library-results-count muted small">{resultsLabel}</span>
        </div>
      </header>

      {!hasAnyResults ? (
        <section className="library-section library-empty-card">
          <h2 className="library-section-title">No matching books</h2>
          <p className="library-empty muted">
            Try a different keyword.
          </p>
        </section>
      ) : null}

      <section className="library-section">
        <ul className="book-grid book-grid-in-series">
          {filtered.map((book) => (
            <li key={book.id}>
              <BookCard
                book={book}
                progressMap={progressMap}
                coverSrc={
                  coverByBookId?.[book.id] ?? DEFAULT_LIBRARY_BOOK_COVER
                }
              />
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
