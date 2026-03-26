import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useLibrary } from '../context/LibraryContext'
import {
  firstChapter,
  hasChapter,
} from '../utils/book'
import type { Book } from '../types/library'
import {
  loadProgressMap,
} from '../utils/readerStorage'

const CARD_COVERS = [
  '/covers/IMG_0070.JPG',
  '/covers/IMG_0071.JPG',
  '/covers/IMG_0072.JPG',
  '/covers/IMG_0073.JPG',
  '/covers/IMG_0074.JPG',
  '/covers/IMG_0075.JPG',
  '/covers/IMG_0076.JPG',
  '/covers/IMG_0077.JPG',
  '/covers/IMG_0078.JPG',
  '/covers/IMG_0079.JPG',
  '/covers/IMG_0080.JPG',
  '/covers/IMG_0081.JPG',
]

const DEFAULT_BOOK_COVER = '/books/naked-family-cover.png'
type SortMode =
  | 'az'
  | 'za'
  | 'recent'

function hashIndex(seed: string, length: number) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return length ? hash % length : 0
}

function coverForBook(bookId: string) {
  if (!CARD_COVERS.length) return DEFAULT_BOOK_COVER
  return CARD_COVERS[hashIndex(bookId, CARD_COVERS.length)]
}

function BookCard({
  book,
  progressMap,
  cover,
}: {
  book: Book
  progressMap: Record<string, { chapterId: string; updatedAt?: number }>
  cover: string
}) {
  const first = firstChapter(book)
  const to = first ? `/read/${book.id}/${first.id}` : `/read/${book.id}`
  const progress = progressMap[book.id]
  const continueTo =
    progress && hasChapter(book, progress.chapterId)
      ? `/read/${book.id}/${progress.chapterId}`
      : undefined

  return (
    <article className="book-card">
      <img className="book-card-cover" src={cover} alt={`${book.title} cover`} loading="lazy" />
      <span className="book-card-title">{book.title}</span>
      {book.subtitle ? (
        <span className="book-card-sub muted">{book.subtitle}</span>
      ) : null}
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

  const resolvedCover = (bookId: string) => coverForBook(bookId) || DEFAULT_BOOK_COVER
  const progressMap = useMemo(() => loadProgressMap(), [state, query, sortMode])

  const compareBooks = (a: Book, b: Book) => {
    const alpha = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    if (sortMode === 'az') return alpha
    if (sortMode === 'za') return -alpha
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
              <BookCard book={book} progressMap={progressMap} cover={resolvedCover(book.id)} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
