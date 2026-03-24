import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useLibrary } from '../context/LibraryContext'
import {
  bookChapterCount,
  firstChapter,
  groupBooksByManuscript,
  partitionSinglesAndSeries,
  findChapter,
  hasChapter,
  chapterDisplayTitle,
} from '../utils/book'
import type { Book } from '../types/library'
import type { ManuscriptGroup } from '../utils/book'
import {
  getReadingStreakDays,
  getTodayReadMinutes,
  loadBookmarks,
  loadCoverOverrides,
  loadProgressMap,
  setCoverOverride,
} from '../utils/readerStorage'
import type { ReaderBookmark } from '../utils/readerStorage'

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

function nextCover(bookId: string, current?: string) {
  if (!CARD_COVERS.length) return DEFAULT_BOOK_COVER
  const base = current && CARD_COVERS.includes(current) ? current : coverForBook(bookId)
  const idx = CARD_COVERS.indexOf(base)
  const nextIdx = (idx + 1) % CARD_COVERS.length
  return CARD_COVERS[nextIdx]
}

function BookCard({
  book,
  variant,
  progressMap,
  cover,
  onShuffleCover,
}: {
  book: Book
  variant: 'single' | 'part'
  progressMap: Record<string, { chapterId: string }>
  cover: string
  onShuffleCover: (bookId: string) => void
}) {
  const first = firstChapter(book)
  const chapters = bookChapterCount(book)
  const to = first ? `/read/${book.id}/${first.id}` : `/read/${book.id}`
  const progress = progressMap[book.id]
  const continueTo =
    progress && hasChapter(book, progress.chapterId)
      ? `/read/${book.id}/${progress.chapterId}`
      : undefined
  if (variant === 'part') {
    return (
      <article className="book-card book-card-part">
        <img className="book-card-cover" src={cover} alt={`${book.title} cover`} loading="lazy" />
        <span className="book-card-title">{book.subtitle ?? 'Part'}</span>
        {continueTo ? (
          <span className="book-card-continue muted small">Continue where you left off</span>
        ) : null}
        <span className="book-card-meta muted small">
          {chapters} chapter{chapters === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          className="book-card-cover-shuffle"
          onClick={() => onShuffleCover(book.id)}
          title="Change cover"
          aria-label="Change cover image"
        >
          Shuffle cover
        </button>
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
      <span className="book-card-meta muted small">
        {chapters} chapter{chapters === 1 ? '' : 's'}
      </span>
      <button
        type="button"
        className="book-card-cover-shuffle"
        onClick={() => onShuffleCover(book.id)}
        title="Change cover"
        aria-label="Change cover image"
      >
        Shuffle cover
      </button>
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

function CollectionStrip({
  title,
  books,
  coverFor,
}: {
  title: string
  books: Book[]
  coverFor: (bookId: string) => string
}) {
  if (!books.length) return null
  return (
    <section className="library-collection">
      <h3 className="library-collection-title">{title}</h3>
      <ul className="library-collection-list">
        {books.map((book) => {
          const first = firstChapter(book)
          const to = first ? `/read/${book.id}/${first.id}` : `/read/${book.id}`
          return (
            <li key={`${title}-${book.id}`}>
              <Link className="library-collection-item" to={to}>
                <img className="library-collection-cover" src={coverFor(book.id)} alt={`${book.title} cover`} loading="lazy" />
                <span className="library-collection-name">{book.title}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function LibraryPage() {
  const { state } = useLibrary()
  const [query, setQuery] = useState('')
  const [installReady, setInstallReady] = useState(false)
  const [installEvent, setInstallEvent] = useState<Event | null>(null)
  const [coverOverrides, setCoverOverrides] = useState<Record<string, string>>(
    () => loadCoverOverrides(),
  )

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault?.()
      setInstallEvent(e)
      setInstallReady(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall as EventListener)
    return () =>
      window.removeEventListener(
        'beforeinstallprompt',
        onBeforeInstall as EventListener,
      )
  }, [])

  const streakDays = getReadingStreakDays()
  const todayMinutes = getTodayReadMinutes()

  const resolvedCover = (bookId: string) =>
    coverOverrides[bookId] || coverForBook(bookId) || DEFAULT_BOOK_COVER

  const onShuffleCover = (bookId: string) => {
    const next = nextCover(bookId, resolvedCover(bookId))
    setCoverOverride(bookId, next)
    setCoverOverrides((prev) => ({ ...prev, [bookId]: next }))
  }

  const onInstall = async () => {
    const deferred = installEvent as Event & {
      prompt?: () => Promise<void>
      userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>
    }
    if (!deferred?.prompt) return
    await deferred.prompt()
    setInstallReady(false)
  }

  const { singles, series } = useMemo(() => {
    if (state.status !== 'ready') {
      return { singles: [] as Book[], series: [] as ManuscriptGroup[] }
    }
    const groups = groupBooksByManuscript(state.data.books)
    return partitionSinglesAndSeries(groups)
  }, [state])

  const resumeEntries = useMemo(() => {
    if (state.status !== 'ready') return []
    const progressMap = loadProgressMap()
    const q = query.trim().toLowerCase()

    const entries: Array<{
      key: string
      book: Book
      chapterId: string
      title: string
      subtitle?: string
      updatedAt: number
    }> = []

    for (const book of state.data.books) {
      const p = progressMap[book.id]
      if (!p) continue
      if (!hasChapter(book, p.chapterId)) continue
      const found = findChapter(book, p.chapterId)
      if (!found) continue

      const display = chapterDisplayTitle(found.section, found.chapter, book.subtitle)
      if (q) {
        const hay = `${book.title} ${book.subtitle ?? ''} ${display}`.toLowerCase()
        if (!hay.includes(q)) continue
      }

      entries.push({
        key: `${book.id}:${p.chapterId}`,
        book,
        chapterId: p.chapterId,
        title: display,
        subtitle: book.subtitle,
        updatedAt: p.updatedAt,
      })
    }

    entries.sort((a, b) => b.updatedAt - a.updatedAt)
    return entries.slice(0, 6)
  }, [state, query])

  const bookmarkEntries = useMemo(() => {
    if (state.status !== 'ready') return []
    const q = query.trim().toLowerCase()
    const bookmarks = loadBookmarks()
    const entries: Array<{
      key: string
      book: Book
      chapterId: string
      title: string
      subtitle?: string
      createdAt: number
    }> = []

    for (const bm of bookmarks as ReaderBookmark[]) {
      const book = state.data.books.find((b) => b.id === bm.bookId)
      if (!book) continue
      if (!hasChapter(book, bm.chapterId)) continue
      const found = findChapter(book, bm.chapterId)
      if (!found) continue
      const display = chapterDisplayTitle(found.section, found.chapter, book.subtitle)

      if (q) {
        const hay = `${book.title} ${book.subtitle ?? ''} ${display}`.toLowerCase()
        if (!hay.includes(q)) continue
      }

      entries.push({
        key: `${bm.bookId}:${bm.chapterId}`,
        book,
        chapterId: bm.chapterId,
        title: display,
        subtitle: book.subtitle,
        createdAt: bm.createdAt,
      })
    }

    entries.sort((a, b) => b.createdAt - a.createdAt)
    return entries.slice(0, 6)
  }, [state, query])

  const filteredSingles = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return singles
    return singles.filter((book) => {
      const first = firstChapter(book)
      const hay = `${book.title} ${book.subtitle ?? ''} ${first?.title ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [singles, query])

  const filteredSeries = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return series
    return series
      .map((g) => ({
        ...g,
        books: g.books.filter((b) => {
          const first = firstChapter(b)
          const hay = `${b.title} ${b.subtitle ?? ''} ${first?.title ?? ''}`.toLowerCase()
          return hay.includes(q)
        }),
      }))
      .filter((g) => g.books.length > 0)
  }, [series, query])
  const progressMap = useMemo(() => loadProgressMap(), [state, query])
  const allBooks = state.status === 'ready' ? state.data.books : []
  const shortReads = useMemo(
    () => allBooks.filter((b) => bookChapterCount(b) <= 6).slice(0, 6),
    [allBooks],
  )
  const longReads = useMemo(
    () => allBooks.filter((b) => bookChapterCount(b) >= 10).slice(0, 6),
    [allBooks],
  )
  const mostRead = useMemo(() => {
    const ids = new Set(Object.keys(progressMap))
    return allBooks.filter((b) => ids.has(b.id)).slice(0, 6)
  }, [allBooks, progressMap])

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
  const hasAnyResults = filteredSingles.length > 0 || filteredSeries.length > 0

  return (
    <main className="page library-page">
      <header className="library-header">
        <h1>{title}</h1>
        <p className="muted">Search and pick a book or part</p>
        <p className="library-goal-chip">
          {streakDays > 0 ? `${streakDays}-day streak` : 'Start your reading streak'} · today {todayMinutes} min
        </p>

        <div className="library-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books, parts, chapters..."
            className="library-search-input"
          />
        </div>
      </header>

      {installReady ? (
        <section className="library-section library-install-card">
          <h2 className="library-section-title">Install app</h2>
          <p className="library-empty muted">Use offline, open faster, and read like a native app.</p>
          <button type="button" className="library-empty-cta library-empty-cta-button" onClick={onInstall}>
            Install now
          </button>
        </section>
      ) : null}

      <section className="library-section">
        <h2 className="library-section-title">Collections</h2>
        <div className="library-collections-grid">
          <CollectionStrip title="Short reads" books={shortReads} coverFor={resolvedCover} />
          <CollectionStrip title="Long reads" books={longReads} coverFor={resolvedCover} />
          <CollectionStrip title="Most read" books={mostRead} coverFor={resolvedCover} />
        </div>
      </section>

      {resumeEntries.length ? (
        <section className="library-section">
          <h2 className="library-section-title">Continue reading</h2>
          <ul className="library-quick-list">
            {resumeEntries.map((e) => (
              <li key={e.key}>
                <Link className="quick-card" to={`/read/${e.book.id}/${e.chapterId}`}>
                  <img className="quick-card-cover" src={resolvedCover(e.book.id)} alt={`${e.book.title} cover`} loading="lazy" />
                  <span className="quick-card-title">{e.book.title}</span>
                  {e.subtitle ? <span className="quick-card-sub muted">{e.subtitle}</span> : null}
                  <span className="quick-card-meta muted">{e.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="library-section">
          <h2 className="library-section-title">Continue reading</h2>
          <p className="library-empty muted">
            No recent reading yet. Open any chapter and your place will appear here.
          </p>
        </section>
      )}

      {bookmarkEntries.length ? (
        <section className="library-section">
          <h2 className="library-section-title">Bookmarks</h2>
          <ul className="library-quick-list">
            {bookmarkEntries.map((e) => (
              <li key={e.key}>
                <Link className="quick-card" to={`/read/${e.book.id}/${e.chapterId}`}>
                  <img className="quick-card-cover" src={resolvedCover(e.book.id)} alt={`${e.book.title} cover`} loading="lazy" />
                  <span className="quick-card-title">{e.book.title}</span>
                  {e.subtitle ? <span className="quick-card-sub muted">{e.subtitle}</span> : null}
                  <span className="quick-card-meta muted">{e.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="library-section">
          <h2 className="library-section-title">Bookmarks</h2>
          <p className="library-empty muted">
            No bookmarks yet. Use the bookmark icon while reading to save chapters.
          </p>
        </section>
      )}

      {!hasAnyResults ? (
        <section className="library-section library-empty-card">
          <h2 className="library-section-title">No matching books</h2>
          <p className="library-empty muted">
            Try a different keyword or clear search to see your full library.
          </p>
          <button
            type="button"
            className="library-empty-cta library-empty-cta-button"
            onClick={() => setQuery('')}
          >
            Clear search
          </button>
        </section>
      ) : null}

      <ul className="library-catalog">
        {filteredSingles.length > 0 ? (
          <li className="library-catalog-row library-catalog-omnibus">
            <section
              className="library-series"
              aria-labelledby="library-singles-heading"
            >
              <h2 className="library-series-heading" id="library-singles-heading">
                Books
              </h2>
              <ul className="book-grid book-grid-in-series">
                {filteredSingles.map((book) => (
                  <li key={book.id}>
                    <BookCard book={book} variant="single" progressMap={progressMap} cover={resolvedCover(book.id)} onShuffleCover={onShuffleCover} />
                  </li>
                ))}
              </ul>
            </section>
          </li>
        ) : null}

        {filteredSeries.map(({ manuscriptKey, books }) => (
          <li
            key={manuscriptKey}
            className="library-catalog-row library-catalog-series"
          >
            <section
              className="library-series"
              aria-labelledby={`series-${manuscriptKey}`}
            >
              <h2 className="library-series-heading" id={`series-${manuscriptKey}`}>
                {books[0].title}
              </h2>
              <ul className="book-grid book-grid-in-series">
                {books.map((book) => (
                  <li key={book.id}>
                    <BookCard book={book} variant="part" progressMap={progressMap} cover={resolvedCover(book.id)} onShuffleCover={onShuffleCover} />
                  </li>
                ))}
              </ul>
            </section>
          </li>
        ))}
      </ul>
    </main>
  )
}
