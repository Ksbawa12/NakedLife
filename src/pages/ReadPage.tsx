import { Link, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChapterContent } from '../components/ChapterContent'
import { useBook, useLibrary } from '../context/LibraryContext'
import {
  bookChapterCount,
  chapterDisplayTitle,
  chaptersInOrder,
  findChapter,
  firstChapter,
  hasChapter,
} from '../utils/book'
import {
  applyChapterSearch,
  clearChapterSearch,
  setActiveSearchMark,
} from '../utils/chapterDomSearch'
import { downloadBookPdf, downloadChapterPdf } from '../utils/pdfExport'
import {
  addNote,
  addReadingMinutes,
  isBookmarked,
  loadNotes,
  loadProgressMap,
  removeNote,
  removeBookmark,
  saveProgress,
  upsertBookmark,
} from '../utils/readerStorage'

function splitChapterHeading(title: string) {
  const m = title.match(/^(Chapter\s+\d+)\s+(.+)$/i)
  if (!m) return { lead: title, tail: '' }
  return { lead: m[1], tail: m[2] }
}

export function ReadPage() {
  const { bookId, chapterId } = useParams<{
    bookId: string
    chapterId: string
  }>()
  const navigate = useNavigate()
  const { state } = useLibrary()
  const book = useBook(bookId)

  const flat = useMemo(() => (book ? chaptersInOrder(book) : []), [book])

  const currentIndex = useMemo(
    () => flat.findIndex((x) => x.chapter.id === chapterId),
    [flat, chapterId],
  )

  const n = flat.length

  const allBooks = useMemo(
    () => (state.status === 'ready' ? state.data.books : []),
    [state],
  )

  const partNav = useMemo(() => {
    if (!allBooks.length) return { prev: null as typeof book | null, next: null as typeof book | null }
    if (!book?.manuscriptKey || typeof book.partNumber !== 'number') {
      return { prev: null as typeof book | null, next: null as typeof book | null }
    }
    const parts = allBooks
      .filter((b) => b.manuscriptKey === book.manuscriptKey && typeof b.partNumber === 'number')
      .sort((a, b) => (a.partNumber ?? 0) - (b.partNumber ?? 0))

    if (parts.length < 2) {
      return { prev: null as typeof book | null, next: null as typeof book | null }
    }

    const idx = parts.findIndex((p) => p.id === book.id)
    return {
      prev: idx > 0 ? parts[idx - 1] : null,
      next: idx >= 0 && idx < parts.length - 1 ? parts[idx + 1] : null,
    }
  }, [allBooks, book])

  const prevPart = partNav.prev
  const nextPart = partNav.next
  const prevFirst = prevPart ? firstChapter(prevPart) : undefined
  const nextFirst = nextPart ? firstChapter(nextPart) : undefined

  const [bookmarked, setBookmarked] = useState(false)
  const [chaptersOpen, setChaptersOpen] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [wordCount, setWordCount] = useState(0)
  const [notesOpen, setNotesOpen] = useState(false)
  const [selectionText, setSelectionText] = useState('')
  const [selectionNote, setSelectionNote] = useState('')
  const [selectionColor, setSelectionColor] = useState<
    'sand' | 'gold' | 'mint' | 'sky' | 'rose'
  >('sand')
  const [ambient, setAmbient] = useState<'off' | 'rain' | 'wind'>('off')
  const [lookup, setLookup] = useState<{ word: string; meaning: string } | null>(null)
  const [readerNight, setReaderNight] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [tocQuery, setTocQuery] = useState('')
  const [pdfBusy, setPdfBusy] = useState<'chapter' | 'book' | null>(null)
  const [articleRoot, setArticleRoot] = useState<HTMLElement | null>(null)
  const [chapterFindQuery, setChapterFindQuery] = useState('')
  const [chapterFindIndex, setChapterFindIndex] = useState(0)
  const searchMarksRef = useRef<HTMLElement[]>([])
  const [rulerOn, setRulerOn] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [outlineItems, setOutlineItems] = useState<Array<{ text: string; tag: string }>>([])
  const outlineElsRef = useRef<Element[]>([])
  const [bookPdfProgress, setBookPdfProgress] = useState('')
  const [findMatchCount, setFindMatchCount] = useState(0)

  useEffect(() => {
    if (!bookId || !chapterId) return
    setBookmarked(isBookmarked(bookId, chapterId))
  }, [bookId, chapterId])

  useEffect(() => {
    document.body.classList.toggle('focus-mode', focusMode)
    return () => document.body.classList.remove('focus-mode')
  }, [focusMode])

  useEffect(() => {
    const onOpenChapters = () => setChaptersOpen(true)
    window.addEventListener('reader-open-chapters', onOpenChapters)
    return () => window.removeEventListener('reader-open-chapters', onOpenChapters)
  }, [])

  useEffect(() => {
    if (state.status !== 'ready') return
    if (!bookId || !chapterId) return
    const map = loadProgressMap()
    const p = map[bookId]
    if (p?.chapterId === chapterId) {
      window.scrollTo({ top: p.scrollY ?? 0, behavior: 'auto' })
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [state.status, bookId, chapterId])

  useEffect(() => {
    if (!bookId || !chapterId) return
    const timer = window.setInterval(() => addReadingMinutes(1), 60000)
    return () => window.clearInterval(timer)
  }, [bookId, chapterId])

  useEffect(() => {
    if (ambient === 'off') return
    const ctx = new AudioContext()
    const bufferSize = 2 * ctx.sampleRate
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i += 1) {
      output[i] = (Math.random() * 2 - 1) * (ambient === 'rain' ? 0.12 : 0.06)
    }
    const whiteNoise = ctx.createBufferSource()
    whiteNoise.buffer = noiseBuffer
    whiteNoise.loop = true
    const gainNode = ctx.createGain()
    gainNode.gain.value = ambient === 'rain' ? 0.12 : 0.08
    whiteNoise.connect(gainNode)
    gainNode.connect(ctx.destination)
    whiteNoise.start(0)
    return () => {
      whiteNoise.stop()
      void ctx.close()
    }
  }, [ambient])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const v = localStorage.getItem('reader-night-mode')
      setReaderNight(v === '1')
      if (v === '1') document.body.classList.add('reader-night-mode')
    } catch {
      /* ignore */
    }
    return () => document.body.classList.remove('reader-night-mode')
  }, [])

  useEffect(() => {
    document.body.classList.toggle('reader-night-mode', readerNight)
    try {
      localStorage.setItem('reader-night-mode', readerNight ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [readerNight])

  useEffect(() => {
    setChaptersOpen(false)
  }, [bookId, chapterId])

  useEffect(() => {
    setChapterFindQuery('')
    setChapterFindIndex(0)
    searchMarksRef.current = []
    setFindMatchCount(0)
  }, [chapterId])

  useEffect(() => {
    if (!chaptersOpen) setTocQuery('')
  }, [chaptersOpen])

  useEffect(() => {
    const root = articleRoot
    if (!root) {
      searchMarksRef.current = []
      setFindMatchCount(0)
      return
    }
    clearChapterSearch(root)
    const q = chapterFindQuery.trim()
    if (q.length < 2) {
      searchMarksRef.current = []
      setChapterFindIndex(0)
      setFindMatchCount(0)
      return
    }
    const marks = applyChapterSearch(root, q)
    searchMarksRef.current = marks
    setChapterFindIndex(0)
    setFindMatchCount(marks.length)
  }, [articleRoot, chapterId, chapterFindQuery])

  useEffect(() => {
    const marks = searchMarksRef.current
    if (!marks.length) return
    const idx = Math.min(Math.max(0, chapterFindIndex), marks.length - 1)
    setActiveSearchMark(marks, idx)
  }, [chapterFindIndex])

  useEffect(() => {
    const root = articleRoot
    if (!root) {
      outlineElsRef.current = []
      setOutlineItems([])
      return
    }
    const els = [...root.querySelectorAll('h1,h2,h3,h4')]
    outlineElsRef.current = els
    setOutlineItems(
      els.map((el) => ({
        text: el.textContent?.trim() ?? '',
        tag: el.tagName.toLowerCase(),
      })),
    )
  }, [articleRoot, wordCount, chapterId])

  useEffect(() => {
    if (!rulerOn) {
      document.body.classList.remove('reading-ruler-active')
      return
    }
    document.body.classList.add('reading-ruler-active')
    const onMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--reading-ruler-y', `${e.clientY}px`)
    }
    document.documentElement.style.setProperty('--reading-ruler-y', `${window.innerHeight / 2}px`)
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.body.classList.remove('reading-ruler-active')
    }
  }, [rulerOn])

  useEffect(() => {
    if (state.status !== 'ready') return
    if (!bookId || !chapterId) return

    let t: number | undefined
    const onScroll = () => {
      if (t) window.clearTimeout(t)
      t = window.setTimeout(() => {
        saveProgress({
          bookId,
          chapterId,
          updatedAt: Date.now(),
          scrollY: window.scrollY ?? 0,
        })
      }, 250)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (t) window.clearTimeout(t)
      window.removeEventListener('scroll', onScroll)
    }
  }, [state.status, bookId, chapterId])

  useEffect(() => {
    if (state.status !== 'ready') return
    if (currentIndex < 0) return
    const nextFile = flat[currentIndex + 1]?.chapter.file
    if (!nextFile) return
    const trimmed = nextFile.replace(/^\/+/, '')
    const nextUrl = '/' + trimmed.split('/').map(encodeURIComponent).join('/')
    void fetch(nextUrl, { cache: 'force-cache' }).catch(() => {
      /* ignore prefetch failures */
    })
  }, [state.status, currentIndex, flat])

  useEffect(() => {
    let lastY = window.scrollY || 0
    let rafId = 0
    let ticking = false
    const root = document.documentElement

    const update = () => {
      const y = window.scrollY || 0
      const maxScroll = Math.max(1, root.scrollHeight - window.innerHeight)
      setScrollProgress(Math.max(0, Math.min(1, y / maxScroll)))

      if (y > lastY + 10 && y > 84) {
        document.body.classList.add('reading-hide-header')
      } else if (y < lastY - 8 || y < 40) {
        document.body.classList.remove('reading-hide-header')
      }
      lastY = y
      ticking = false
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      rafId = window.requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId) window.cancelAnimationFrame(rafId)
      document.body.classList.remove('reading-hide-header')
    }
  }, [bookId, chapterId])

  const goChapter = useCallback(
    (delta: number) => {
      const next = Math.min(Math.max(currentIndex + delta, 0), n - 1)
      const id = flat[next]?.chapter.id
      if (id) navigate(`/read/${bookId}/${id}`)
    },
    [bookId, currentIndex, flat, n, navigate],
  )

  const onToggleBookmark = useCallback(() => {
    if (!bookId || !chapterId) return
    if (bookmarked) {
      removeBookmark(bookId, chapterId)
      setBookmarked(false)
    } else {
      upsertBookmark({
        bookId,
        chapterId,
        createdAt: Date.now(),
        scrollY: window.scrollY ?? 0,
      })
      setBookmarked(true)
    }
  }, [bookId, chapterId, bookmarked])

  const chapterNotes = useMemo(
    () => (bookId && chapterId ? loadNotes().filter((n) => n.bookId === bookId && n.chapterId === chapterId) : []),
    [bookId, chapterId, notesOpen, chapterId],
  )

  useEffect(() => {
    const onToggle = () => onToggleBookmark()
    window.addEventListener('reader-toggle-bookmark', onToggle)
    return () => window.removeEventListener('reader-toggle-bookmark', onToggle)
  }, [onToggleBookmark])

  useEffect(() => {
    if (!bookId || !chapterId) return
    window.dispatchEvent(
      new CustomEvent('reader-bookmark-state', {
        detail: { bookId, chapterId, bookmarked },
      }),
    )
  }, [bookId, chapterId, bookmarked])

  if (state.status === 'loading') {
    return (
      <main className="page read-page">
        <p className="muted">Loading…</p>
      </main>
    )
  }

  if (state.status === 'error' || !bookId) {
    return <Navigate to="/" replace />
  }

  if (!book) {
    return <Navigate to="/" replace />
  }

  if (!bookChapterCount(book)) {
    return <Navigate to="/" replace />
  }

  const start = firstChapter(book)!

  if (!chapterId) {
    return <Navigate to={`/read/${bookId}/${start.id}`} replace />
  }

  if (!hasChapter(book, chapterId)) {
    return <Navigate to={`/read/${bookId}/${start.id}`} replace />
  }

  const found = findChapter(book, chapterId)!
  const displayTitle = chapterDisplayTitle(found.section, found.chapter, book.subtitle)
  const heading = splitChapterHeading(displayTitle)
  const hasPrevChapter = currentIndex > 0
  const hasNextChapter = currentIndex < n - 1
  const showPager = n > 1 || Boolean(prevPart && prevFirst) || Boolean(nextPart && nextFirst)
  const totalMinutes = Math.max(1, Math.round(wordCount / 220))
  const minutesLeft = Math.max(0, Math.ceil(totalMinutes * (1 - scrollProgress)))
  const chapterMapDots = 7
  const chapterMapActive = Math.min(
    chapterMapDots - 1,
    Math.max(0, Math.round(scrollProgress * (chapterMapDots - 1))),
  )
  const nextChapterId = hasNextChapter ? flat[currentIndex + 1]?.chapter.id : undefined
  const endNextTo = nextChapterId
    ? `/read/${book.id}/${nextChapterId}`
    : nextPart && nextFirst
      ? `/read/${nextPart.id}/${nextFirst.id}`
      : undefined
  const endNextLabel = nextChapterId
    ? 'Next chapter'
    : nextPart && nextFirst
      ? 'Next part'
      : undefined
  const saved = loadProgressMap()[book.id]
  const showContinueBanner =
    !!saved && saved.chapterId !== chapterId && hasChapter(book, saved.chapterId)

  return (
    <div className="read-layout">
      <aside className="read-sidebar" aria-label="Chapters">
        <div className="read-sidebar-head">
          <NavLink to="/" className="back-link">
            ← Library
          </NavLink>
          <h2 className="read-book-title">{book.title}</h2>
          {book.subtitle ? (
            <p className="read-book-subtitle muted small">{book.subtitle}</p>
          ) : null}
        </div>
        <nav>
          {book.sections.map((section) => (
            <div key={section.id} className="read-section">
              <ol className="chapter-list">
                {section.chapters.map((ch) => (
                  <li key={ch.id}>
                    <NavLink
                      to={`/read/${book.id}/${ch.id}`}
                      className={({ isActive }) =>
                        isActive ? 'chapter-link active' : 'chapter-link'
                      }
                    >
                      {chapterDisplayTitle(section, ch, book.subtitle)}
                    </NavLink>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </nav>
      </aside>

      <main className="read-main">
        <div className="read-top-tools">
          <div className="read-focus-presets" role="group" aria-label="Reading presets">
            <button type="button" className="read-mini-btn" onClick={() => {
              document.documentElement.style.setProperty('--reader-content-width', '40rem')
              document.documentElement.style.setProperty('--reader-line-height', '1.78')
            }}>Calm</button>
            <button type="button" className="read-mini-btn" onClick={() => {
              document.documentElement.style.setProperty('--reader-content-width', '38rem')
              document.documentElement.style.setProperty('--reader-line-height', '1.9')
            }}>Study</button>
            <button type="button" className="read-mini-btn" onClick={() => {
              document.documentElement.style.setProperty('--reader-content-width', '44rem')
              document.documentElement.style.setProperty('--reader-line-height', '1.7')
            }}>Night</button>
            <span className="read-log-minutes-label muted small" aria-hidden>
              Log time
            </span>
            {([5, 10, 15] as const).map((m) => (
              <button
                key={m}
                type="button"
                className="read-mini-btn"
                onClick={() => addReadingMinutes(m)}
              >
                +{m}m
              </button>
            ))}
          </div>
          <div className="read-focus-presets read-find-row" role="search" aria-label="Find in chapter">
            <input
              className="read-chapter-find-input"
              value={chapterFindQuery}
              onChange={(e) => setChapterFindQuery(e.target.value)}
              placeholder="Find in chapter (2+ letters)"
              aria-label="Find in chapter"
            />
            <button
              type="button"
              className="read-mini-btn"
              disabled={findMatchCount === 0}
              onClick={() =>
                setChapterFindIndex((i) =>
                  findMatchCount ? (i - 1 + findMatchCount) % findMatchCount : 0,
                )
              }
            >
              Prev
            </button>
            <button
              type="button"
              className="read-mini-btn"
              disabled={findMatchCount === 0}
              onClick={() =>
                setChapterFindIndex((i) => (findMatchCount ? (i + 1) % findMatchCount : 0))
              }
            >
              Next
            </button>
            <span className="muted small read-find-meta" aria-live="polite">
              {chapterFindQuery.trim().length >= 2
                ? findMatchCount
                  ? `${Math.min(chapterFindIndex + 1, findMatchCount)} / ${findMatchCount}`
                  : 'No matches'
                : ''}
            </span>
          </div>
          <div className="read-focus-presets" role="group" aria-label="Reader actions">
            <button type="button" className="read-mini-btn" onClick={() => setRulerOn((x) => !x)}>
              Ruler: {rulerOn ? 'On' : 'Off'}
            </button>
            <button type="button" className="read-mini-btn" onClick={() => setOutlineOpen((x) => !x)}>
              Outline
            </button>
            <button type="button" className="read-mini-btn" onClick={() => setNotesOpen((x) => !x)}>Notes</button>
            <button type="button" className="read-mini-btn" onClick={() => setReaderNight((x) => !x)}>
              Night mode: {readerNight ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              className="read-mini-btn"
              disabled={pdfBusy !== null}
              onClick={async () => {
                try {
                  setPdfBusy('chapter')
                  await downloadChapterPdf({
                    bookTitle: book.title,
                    chapterTitle: displayTitle,
                    chapterPath: found.chapter.file,
                    chapterIndex: Math.max(0, currentIndex),
                    totalChapters: Math.max(1, n),
                  })
                } finally {
                  setPdfBusy(null)
                }
              }}
            >
              {pdfBusy === 'chapter' ? 'Preparing PDF…' : 'Download chapter PDF'}
            </button>
            <button
              type="button"
              className="read-mini-btn"
              disabled={pdfBusy !== null}
              onClick={async () => {
                try {
                  setPdfBusy('book')
                  setBookPdfProgress('')
                  const items = chaptersInOrder(book).map((x) => ({
                    title: chapterDisplayTitle(x.section, x.chapter, book.subtitle),
                    path: x.chapter.file,
                  }))
                  await downloadBookPdf({
                    bookTitle: book.title,
                    chapterItems: items,
                    onProgress: (c, t) => setBookPdfProgress(`${c}/${t}`),
                  })
                } finally {
                  setPdfBusy(null)
                  setBookPdfProgress('')
                }
              }}
            >
              {pdfBusy === 'book'
                ? bookPdfProgress
                  ? `Book PDF ${bookPdfProgress}`
                  : 'Preparing PDF…'
                : 'Download book PDF'}
            </button>
            <button
              type="button"
              className="read-mini-btn"
              onClick={() =>
                setAmbient((a) => (a === 'off' ? 'rain' : a === 'rain' ? 'wind' : 'off'))
              }
            >
              Ambient: {ambient}
            </button>
          </div>
        </div>
        {showContinueBanner ? (
          <section className="read-end-card" aria-label="Continue from last position">
            <span className="muted small">You have a newer saved position in this book.</span>
            <Link className="read-end-link read-end-link--next" to={`/read/${book.id}/${saved.chapterId}`}>
              Continue where I left off
            </Link>
          </section>
        ) : null}
        <div
          className="read-progress-line"
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(scrollProgress * 100)}
        >
          <span
            className="read-progress-line-fill"
            style={{ width: `${Math.round(scrollProgress * 100)}%` }}
          />
        </div>

        <header className="read-chapter-header">
          {book.subtitle ? (
            <p className="read-section-eyebrow muted small">{book.subtitle}</p>
          ) : null}
          <p className="read-estimate muted small">
            ~{totalMinutes} min chapter · {minutesLeft <= 1 ? '<1 min left' : `${minutesLeft} min left`}
          </p>
          <h1 className="read-title-lines">
            <span className="read-title-line-1">{heading.lead}</span>
            {heading.tail ? (
              <span className="read-title-line-2">{heading.tail}</span>
            ) : null}
          </h1>
          <div className="chapter-map-dots" aria-hidden="true">
            {Array.from({ length: chapterMapDots }, (_, idx) => (
              <span
                key={idx}
                className={
                  idx <= chapterMapActive
                    ? 'chapter-map-dot chapter-map-dot--active'
                    : 'chapter-map-dot'
                }
              />
            ))}
          </div>
        </header>

        {chaptersOpen ? (
          <div
            className="chapters-drawer-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Chapters drawer"
            onClick={() => setChaptersOpen(false)}
          >
            <div
              className="chapters-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="chapters-drawer-head">
                <div>
                  <NavLink to="/" className="back-link">
                    ← Library
                  </NavLink>
                  <div className="read-book-title">{book.title}</div>
                </div>
                <button
                  type="button"
                  className="chapters-drawer-close"
                  aria-label="Close chapters"
                  onClick={() => setChaptersOpen(false)}
                >
                  ×
                </button>
              </div>

              <input
                className="chapters-search-input"
                value={tocQuery}
                onChange={(e) => setTocQuery(e.target.value)}
                placeholder="Search chapters..."
                aria-label="Search chapters"
              />

              <nav>
                {book.sections.map((section) => (
                  <div key={section.id} className="read-section">
                    <ol className="chapter-list">
                      {section.chapters
                        .map((ch) => ({
                          ch,
                          title: chapterDisplayTitle(section, ch, book.subtitle),
                        }))
                        .filter(({ title }) => {
                          const q = tocQuery.trim().toLowerCase()
                          if (!q) return true
                          return title.toLowerCase().includes(q)
                        })
                        .map(({ ch, title }) => (
                          <li key={ch.id}>
                            <NavLink
                              to={`/read/${book.id}/${ch.id}`}
                              onClick={() => setChaptersOpen(false)}
                              className={({ isActive }) =>
                                isActive
                                  ? 'chapter-link active'
                                  : 'chapter-link'
                              }
                            >
                              {title}
                            </NavLink>
                          </li>
                        ))}
                    </ol>
                  </div>
                ))}
              </nav>
            </div>
          </div>
        ) : null}

        {outlineOpen ? (
          <aside className="read-outline-panel" aria-label="Chapter outline">
            <div className="read-outline-head">
              <span className="read-outline-title">Outline</span>
              <button type="button" className="read-mini-btn" onClick={() => setOutlineOpen(false)}>
                Close
              </button>
            </div>
            {outlineItems.length ? (
              <ol className="read-outline-list">
                {outlineItems.map((item, i) => (
                  <li
                    key={`${item.tag}-${i}-${item.text.slice(0, 24)}`}
                    className={`read-outline-item read-outline-item--${item.tag}`}
                  >
                    <button
                      type="button"
                      className="read-outline-link"
                      onClick={() => {
                        const el = outlineElsRef.current[i]
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                    >
                      {item.text || '(untitled)'}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted small">No headings found in this chapter.</p>
            )}
          </aside>
        ) : null}

        <div
          key={chapterId}
          className="read-chapter-transition"
          onClick={(e) => {
            const el = e.target as HTMLElement | null
            if (!el) return
            if (el.closest('a, button, input, textarea, select')) return
            const hasSelection = Boolean(window.getSelection()?.toString().trim())
            if (hasSelection) return
            setFocusMode((x) => !x)
          }}
          onDoubleClick={async () => {
            const selected = window.getSelection()?.toString().trim() ?? ''
            if (!selected) return
            const word = selected.split(/\s+/)[0].replace(/[^a-zA-Z-]/g, '')
            if (!word) return
            try {
              const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
              if (!res.ok) throw new Error('lookup failed')
              const data = (await res.json()) as Array<{ meanings?: Array<{ definitions?: Array<{ definition?: string }> }> }>
              const meaning = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition ?? 'No quick meaning found.'
              setLookup({ word, meaning })
            } catch {
              setLookup({ word, meaning: 'Dictionary unavailable right now.' })
            }
          }}
          onMouseUp={() => {
            const selected = window.getSelection()?.toString().trim() ?? ''
            if (selected.length >= 3) setSelectionText(selected.slice(0, 280))
          }}
        >
          <ChapterContent
            path={found.chapter.file}
            titleHint={displayTitle}
            onWordCount={setWordCount}
            bodyClassName="read-chapter-body"
            onArticleReady={setArticleRoot}
          />
        </div>
        {selectionText ? (
          <div className="read-selection-bar">
            <span className="muted small">Selected: "{selectionText.slice(0, 42)}{selectionText.length > 42 ? '…' : ''}"</span>
            <div className="highlight-colors" role="group" aria-label="Highlight color">
              {([
                ['sand', 'Sand'],
                ['gold', 'Gold'],
                ['mint', 'Mint'],
                ['sky', 'Sky'],
                ['rose', 'Rose'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={
                    selectionColor === id
                      ? `highlight-color highlight-color--${id} highlight-color--active`
                      : `highlight-color highlight-color--${id}`
                  }
                  aria-label={`Highlight color ${label}`}
                  onClick={() => setSelectionColor(id)}
                />
              ))}
            </div>
            <input
              className="read-note-input"
              value={selectionNote}
              onChange={(e) => setSelectionNote(e.target.value)}
              placeholder="Optional note"
            />
            <button
              type="button"
              className="read-mini-btn"
              onClick={() => {
                if (!bookId || !chapterId || !selectionText) return
                addNote({
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  bookId,
                  chapterId,
                  text: selectionText,
                  note: selectionNote.trim() || undefined,
                  kind: 'highlight',
                  color: selectionColor,
                  createdAt: Date.now(),
                })
                setSelectionText('')
                setSelectionNote('')
                setNotesOpen(true)
              }}
            >
              Save highlight
            </button>
          </div>
        ) : null}
        {notesOpen ? (
          <section className="read-notes-panel">
            <h3>Highlights & notes</h3>
            {chapterNotes.length ? (
              <ul className="read-notes-list">
                {chapterNotes.map((n) => (
                  <li key={n.id} className="read-note-item">
                    <p>"{n.text}"</p>
                    {n.note ? <p className="muted small">{n.note}</p> : null}
                    <button type="button" className="read-mini-btn" onClick={() => {
                      removeNote(n.id)
                      setNotesOpen(true)
                    }}>Remove</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No notes for this chapter yet.</p>
            )}
          </section>
        ) : null}
        {lookup ? (
          <div className="read-lookup-pop" role="status">
            <strong>{lookup.word}:</strong> {lookup.meaning}
            <button type="button" className="read-mini-btn" onClick={() => setLookup(null)}>Close</button>
          </div>
        ) : null}

        {showPager ? (
          <div className="read-pager-toolbar read-pager-toolbar--inline">
            {hasPrevChapter ? (
              <button
                type="button"
                className="read-pager-btn"
                aria-label="Previous chapter"
                onClick={() => goChapter(-1)}
              >
                ‹ Previous chapter
              </button>
            ) : prevPart && prevFirst ? (
              <Link
                className="read-pager-btn"
                aria-label="Previous part"
                to={`/read/${prevPart.id}/${prevFirst.id}`}
              >
                ‹ Previous part
              </Link>
            ) : (
              <button
                type="button"
                className="read-pager-btn"
                aria-label="Previous chapter"
                disabled
              >
                ‹ Previous chapter
              </button>
            )}
            <span className="read-pager-count muted small">
              {currentIndex + 1} / {n}
            </span>
            {hasNextChapter ? (
              <button
                type="button"
                className="read-pager-btn"
                aria-label="Next chapter"
                onClick={() => goChapter(1)}
              >
                Next chapter ›
              </button>
            ) : nextPart && nextFirst ? (
              <Link
                className="read-pager-btn"
                aria-label="Next part"
                to={`/read/${nextPart.id}/${nextFirst.id}`}
              >
                Next part ›
              </Link>
            ) : (
              <button
                type="button"
                className="read-pager-btn"
                aria-label="Next chapter"
                disabled
              >
                Next chapter ›
              </button>
            )}
          </div>
        ) : null}

        <section className={`read-end-card ${!endNextTo ? 'read-end-card--done' : ''}`} aria-label="Chapter end actions">
          <Link className="read-end-link" to="/">
            Back to library
          </Link>
          {endNextTo && endNextLabel ? (
            <Link className="read-end-link read-end-link--next" to={endNextTo}>
              {endNextLabel} ›
            </Link>
          ) : (
            <span className="read-end-done muted small">You reached the end of this part.</span>
          )}
        </section>
      </main>
    </div>
  )
}
