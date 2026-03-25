import { Link, useLocation } from 'react-router-dom'
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
  loadPinnedBooks,
  loadProgressMap,
  setCoverOverride,
  togglePinnedBook,
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
type SortMode = 'az' | 'za' | 'chapters-asc' | 'chapters-desc' | 'recent'
type FilterChip = 'all' | 'unread' | 'in-progress' | 'bookmarked' | 'short' | 'long'

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
  pinned,
  onTogglePin,
}: {
  book: Book
  variant: 'single' | 'part'
  progressMap: Record<string, { chapterId: string }>
  cover: string
  onShuffleCover: (bookId: string) => void
  pinned: boolean
  onTogglePin: (bookId: string) => void
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
        <button
          type="button"
          className={pinned ? 'book-card-cover-shuffle book-card-cover-shuffle--active' : 'book-card-cover-shuffle'}
          onClick={() => onTogglePin(book.id)}
        >
          {pinned ? 'Pinned' : 'Pin'}
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
      <button
        type="button"
        className={pinned ? 'book-card-cover-shuffle book-card-cover-shuffle--active' : 'book-card-cover-shuffle'}
        onClick={() => onTogglePin(book.id)}
      >
        {pinned ? 'Pinned' : 'Pin'}
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

export function LibraryPage({
  navQuery,
  onNavQueryChange,
}: {
  navQuery?: string
  onNavQueryChange?: (value: string) => void
}) {
  const { state } = useLibrary()
  const location = useLocation()
  const [localQuery, setLocalQuery] = useState('')
  const query = navQuery ?? localQuery
  const setQuery = onNavQueryChange ?? setLocalQuery
  const [sortMode, setSortMode] = useState<SortMode>('az')
  const [chip, setChip] = useState<FilterChip>('all')
  const [installReady, setInstallReady] = useState(false)
  const [installEvent, setInstallEvent] = useState<Event | null>(null)
  const [coverOverrides, setCoverOverrides] = useState<Record<string, string>>(
    () => loadCoverOverrides(),
  )
  const [pinnedBooks, setPinnedBooks] = useState<string[]>(() => loadPinnedBooks())

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

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (!hash) return
    const el = document.getElementById(hash)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  const streakDays = getReadingStreakDays()
  const todayMinutes = getTodayReadMinutes()

  const resolvedCover = (bookId: string) =>
    coverOverrides[bookId] || coverForBook(bookId) || DEFAULT_BOOK_COVER

  const onShuffleCover = (bookId: string) => {
    const next = nextCover(bookId, resolvedCover(bookId))
    setCoverOverride(bookId, next)
    setCoverOverrides((prev) => ({ ...prev, [bookId]: next }))
  }
  const onTogglePin = (bookId: string) => {
    togglePinnedBook(bookId)
    setPinnedBooks(loadPinnedBooks())
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
  const progressMap = useMemo(() => loadProgressMap(), [state, query])

  const compareBooks = (a: Book, b: Book) => {
    const alpha = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    if (sortMode === 'az') return alpha
    if (sortMode === 'za') return -alpha
    if (sortMode === 'chapters-asc') return bookChapterCount(a) - bookChapterCount(b) || alpha
    if (sortMode === 'chapters-desc') return bookChapterCount(b) - bookChapterCount(a) || alpha
    const aUpdated = progressMap[a.id]?.updatedAt ?? 0
    const bUpdated = progressMap[b.id]?.updatedAt ?? 0
    return bUpdated - aUpdated || alpha
  }
  const matchesChip = (book: Book) => {
    if (chip === 'all') return true
    const hasProgress = Boolean(progressMap[book.id])
    const hasBookmark = loadBookmarks().some((bm) => bm.bookId === book.id)
    const count = bookChapterCount(book)
    if (chip === 'unread') return !hasProgress
    if (chip === 'in-progress') return hasProgress
    if (chip === 'bookmarked') return hasBookmark
    if (chip === 'short') return count <= 6
    if (chip === 'long') return count >= 10
    return true
  }

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
    return entries.slice(0, 4)
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
    const base = !q
      ? singles
      : singles.filter((book) => {
          const first = firstChapter(book)
          const hay = `${book.title} ${book.subtitle ?? ''} ${first?.title ?? ''}`.toLowerCase()
          return hay.includes(q)
        })
    return [...base].filter(matchesChip).sort(compareBooks)
  }, [singles, query, sortMode, progressMap, chip, bookmarkEntries])

  const filteredSeries = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = !q
      ? series
      : series
          .map((g) => ({
            ...g,
            books: g.books.filter((b) => {
              const first = firstChapter(b)
              const hay = `${b.title} ${b.subtitle ?? ''} ${first?.title ?? ''}`.toLowerCase()
              return hay.includes(q)
            }),
          }))
          .filter((g) => g.books.length > 0)

    const sortedGroups = base.map((g) => ({
      ...g,
      books: [...g.books].filter(matchesChip).sort(compareBooks),
    }))
      .filter((g) => g.books.length > 0)
    return sortedGroups.sort((a, b) => compareBooks(a.books[0], b.books[0]))
  }, [series, query, sortMode, progressMap, chip, bookmarkEntries])

  const sortedResumeEntries = useMemo(() => {
    if (sortMode === 'recent') return resumeEntries
    return [...resumeEntries].sort((a, b) => compareBooks(a.book, b.book))
  }, [resumeEntries, sortMode, progressMap])

  const sortedBookmarkEntries = useMemo(() => {
    if (sortMode === 'recent') return bookmarkEntries
    return [...bookmarkEntries].sort((a, b) => compareBooks(a.book, b.book))
  }, [bookmarkEntries, sortMode, progressMap])

  const allBooks = state.status === 'ready' ? state.data.books : []
  const pinnedList = useMemo(
    () => allBooks.filter((b) => pinnedBooks.includes(b.id)).sort(compareBooks),
    [allBooks, pinnedBooks, sortMode, progressMap],
  )
  const shortReads = useMemo(
    () => allBooks.filter((b) => bookChapterCount(b) <= 6).sort(compareBooks).slice(0, 6),
    [allBooks, sortMode, progressMap],
  )
  const longReads = useMemo(
    () => allBooks.filter((b) => bookChapterCount(b) >= 10).sort(compareBooks).slice(0, 6),
    [allBooks, sortMode, progressMap],
  )
  const mostRead = useMemo(() => {
    const ids = new Set(Object.keys(progressMap))
    return allBooks.filter((b) => ids.has(b.id)).sort(compareBooks).slice(0, 6)
  }, [allBooks, sortMode, progressMap])

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
  const filteredSeriesCount = filteredSeries.reduce((acc, g) => acc + g.books.length, 0)
  const totalResults = filteredSingles.length + filteredSeriesCount
  const hasAnyResults = totalResults > 0

  const trimmedQuery = query.trim()
  const hasSearch = trimmedQuery.length > 0
  const hasChipFilter = chip !== 'all'
  const hasSortFilter = sortMode !== 'az'
  const hasActiveFilters = hasSearch || hasChipFilter || hasSortFilter

  const chipLabels: Record<FilterChip, string> = {
    all: 'All',
    unread: 'Unread',
    'in-progress': 'In Progress',
    bookmarked: 'Bookmarked',
    short: 'Short',
    long: 'Long',
  }

  const sortLabels: Record<SortMode, string> = {
    az: 'A-Z',
    za: 'Z-A',
    'chapters-asc': 'Chapters low-high',
    'chapters-desc': 'Chapters high-low',
    recent: 'Recently read',
  }

  const displayQuery = trimmedQuery.length > 22 ? `${trimmedQuery.slice(0, 22)}...` : trimmedQuery

  const resetAllFilters = () => {
    setQuery('')
    setChip('all')
    setSortMode('az')
  }

  const resultsLabel = `${totalResults} result${totalResults === 1 ? '' : 's'}`

  return (
    <main className="page library-page">
      <header className="library-header">
        <h1>{title}</h1>
        <p className="muted">Search and pick a book or part</p>
        <div className="library-goal-row">
          <p className="library-goal-chip">
            {streakDays > 0 ? `${streakDays}-day streak` : 'Start your reading streak'} · today {todayMinutes} min
          </p>
        </div>
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
            <option value="chapters-asc">Sort: Chapters low-high</option>
            <option value="chapters-desc">Sort: Chapters high-low</option>
            <option value="recent">Sort: Recently read</option>
          </select>
        </div>
        <div className="library-header-divider" />

        <div className="library-filter-chips" role="group" aria-label="Quick filters">
          {([
            ['all', 'All'],
            ['unread', 'Unread'],
            ['in-progress', 'In Progress'],
            ['bookmarked', 'Bookmarked'],
            ['short', 'Short'],
            ['long', 'Long'],
          ] as Array<[FilterChip, string]>).map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={chip === id ? 'library-filter-chip library-filter-chip--active' : 'library-filter-chip'}
              onClick={() => setChip(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="library-header-meta" aria-live="polite">
          <span className="library-results-count muted small">{resultsLabel}</span>
          {hasActiveFilters ? (
            <button type="button" className="library-clear-btn" onClick={resetAllFilters}>
              Reset all
            </button>
          ) : null}
        </div>

        {hasActiveFilters ? (
          <div className="library-active-badges" aria-label="Active filters">
            {hasSearch ? (
              <span className="library-filter-badge library-filter-badge--active">
                Search: {displayQuery}
                <button
                  type="button"
                  className="library-filter-badge-close"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                >
                  x
                </button>
              </span>
            ) : null}
            {hasChipFilter ? (
              <span className="library-filter-badge library-filter-badge--active">
                Filter: {chipLabels[chip]}
                <button
                  type="button"
                  className="library-filter-badge-close"
                  aria-label="Clear filter"
                  onClick={() => setChip('all')}
                >
                  x
                </button>
              </span>
            ) : null}
            {hasSortFilter ? (
              <span className="library-filter-badge library-filter-badge--active">
                Sort: {sortLabels[sortMode]}
                <button
                  type="button"
                  className="library-filter-badge-close"
                  aria-label="Reset sort"
                  onClick={() => setSortMode('az')}
                >
                  x
                </button>
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <section className="library-section" id="pinned">
          <h2 className="library-section-title">Pinned books</h2>
          {pinnedList.length ? (
            <ul className="book-grid book-grid-in-series">
              {pinnedList.map((book) => (
                <li key={book.id}>
                  <BookCard
                    book={book}
                    variant={book.partNumber ? 'part' : 'single'}
                    progressMap={progressMap}
                    cover={resolvedCover(book.id)}
                    onShuffleCover={onShuffleCover}
                    pinned={true}
                    onTogglePin={onTogglePin}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="library-empty muted">
              No pinned books yet. Pin a book to keep it here.
            </p>
          )}
        </section>

      {installReady ? (
        <section className="library-section library-install-card">
          <h2 className="library-section-title">Install app</h2>
          <p className="library-empty muted">Use offline, open faster, and read like a native app.</p>
          <button type="button" className="library-empty-cta library-empty-cta-button" onClick={onInstall}>
            Install now
          </button>
        </section>
      ) : null}

      {resumeEntries.length ? (
        <section className="library-section">
          <h2 className="library-section-title">Continue reading</h2>
          <p className="library-continue-sub muted small">Last read</p>
          <ul className="library-quick-list library-quick-list--horizontal">
            {sortedResumeEntries.map((e) => (
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
        <section className="library-section" id="bookmarks">
          <h2 className="library-section-title">Bookmarks</h2>
          <ul className="library-quick-list">
            {sortedBookmarkEntries.map((e) => (
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
        <section className="library-section" id="bookmarks">
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
            onClick={resetAllFilters}
          >
            Reset filters
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
                    <BookCard book={book} variant="single" progressMap={progressMap} cover={resolvedCover(book.id)} onShuffleCover={onShuffleCover} pinned={pinnedBooks.includes(book.id)} onTogglePin={onTogglePin} />
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
                    <BookCard book={book} variant="part" progressMap={progressMap} cover={resolvedCover(book.id)} onShuffleCover={onShuffleCover} pinned={pinnedBooks.includes(book.id)} onTogglePin={onTogglePin} />
                  </li>
                ))}
              </ul>
            </section>
          </li>
        ))}
      </ul>

      <section className="library-section">
        <h2 className="library-section-title">Collections</h2>
        <div className="library-collections-grid">
          <CollectionStrip title="Short reads" books={shortReads} coverFor={resolvedCover} />
          <CollectionStrip title="Long reads" books={longReads} coverFor={resolvedCover} />
          <CollectionStrip title="Most read" books={mostRead} coverFor={resolvedCover} />
        </div>
      </section>
    </main>
  )
}
