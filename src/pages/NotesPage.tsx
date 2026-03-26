import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useLibrary } from '../context/LibraryContext'
import { chapterDisplayTitle, findChapter } from '../utils/book'
import { loadNotes, removeNote, updateNote } from '../utils/readerStorage'

export function NotesPage() {
  const { state } = useLibrary()
  const [notes, setNotes] = useState(() => loadNotes())
  const [filterBookId, setFilterBookId] = useState('')
  const [filterTag, setFilterTag] = useState('')

  const items = useMemo(() => {
    if (state.status !== 'ready') return []
    return notes
      .map((n) => {
        const book = state.data.books.find((b) => b.id === n.bookId)
        if (!book) return null
        const found = findChapter(book, n.chapterId)
        if (!found) return null
        return {
          ...n,
          bookTitle: book.title,
          chapterTitle: chapterDisplayTitle(found.section, found.chapter, book.subtitle),
        }
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [state, notes])

  const bookOptions = useMemo(() => {
    if (state.status !== 'ready') return []
    const ids = new Set(items.map((i) => i.bookId))
    return state.data.books
      .filter((b) => ids.has(b.id))
      .map((b) => ({ id: b.id, title: b.title }))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
  }, [state, items])

  const allTags = useMemo(() => {
    const s = new Set<string>()
    for (const n of notes) {
      for (const t of n.tags ?? []) {
        if (t.trim()) s.add(t.trim())
      }
    }
    return [...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [notes])

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filterBookId && n.bookId !== filterBookId) return false
      if (filterTag) {
        const tags = n.tags ?? []
        if (!tags.some((t) => t.toLowerCase() === filterTag.toLowerCase())) return false
      }
      return true
    })
  }, [items, filterBookId, filterTag])

  const colorLabel: Record<string, string> = {
    sand: 'Sand',
    gold: 'Gold',
    mint: 'Mint',
    sky: 'Sky',
    rose: 'Rose',
  }

  const refresh = () => setNotes(loadNotes())

  const exportMarkdown = () => {
    const lines = filtered.map((n) => {
      const tags = (n.tags?.length ? `\nTags: ${n.tags.join(', ')}` : '') + '\n'
      const sub = n.note ? `\n\n_${n.note}_` : ''
      return `## ${n.bookTitle} — ${n.chapterTitle}\n\n> ${n.text.replace(/\n/g, ' ')}${sub}${tags}\n---\n`
    })
    const md = `# Notes export\n\n${lines.join('\n')}`
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notes-export-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="page library-page">
      <header className="library-header">
        <h1>Notes</h1>
        <p className="muted">All highlights and notes in one place</p>
        <div className="notes-toolbar">
          <label className="notes-filter-label muted small">
            Book
            <select
              className="library-sort-select notes-filter-select"
              value={filterBookId}
              onChange={(e) => setFilterBookId(e.target.value)}
              aria-label="Filter by book"
            >
              <option value="">All books</option>
              {bookOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </label>
          <label className="notes-filter-label muted small">
            Tag
            <select
              className="library-sort-select notes-filter-select"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              aria-label="Filter by tag"
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="library-empty-cta library-empty-cta-button notes-export-btn"
            disabled={!filtered.length}
            onClick={exportMarkdown}
          >
            Export Markdown
          </button>
        </div>
      </header>

      {!items.length ? (
        <section className="library-section library-empty-card">
          <p className="library-empty muted">No saved notes yet.</p>
          <Link className="library-empty-cta" to="/">
            Back to library
          </Link>
        </section>
      ) : !filtered.length ? (
        <section className="library-section library-empty-card">
          <p className="library-empty muted">No notes match these filters.</p>
          <button
            type="button"
            className="library-empty-cta library-empty-cta-button"
            onClick={() => {
              setFilterBookId('')
              setFilterTag('')
            }}
          >
            Clear filters
          </button>
        </section>
      ) : (
        <section className="library-section">
          <ul className="read-notes-list">
            {filtered.map((n) => (
              <li key={n.id} className="read-note-item">
                <p className="small muted">
                  {n.bookTitle} · {n.chapterTitle}
                </p>
                {n.kind === 'highlight' ? (
                  <p className="muted small">
                    Highlight{n.color ? ` · ${colorLabel[n.color] ?? n.color}` : ''}
                  </p>
                ) : null}
                <p>"{n.text}"</p>
                {n.note ? <p className="muted small">{n.note}</p> : null}
                <label className="notes-tags-label muted small">
                  Tags (comma-separated)
                  <input
                    key={`${n.id}-${(n.tags ?? []).join('|')}`}
                    className="read-note-input notes-tags-input"
                    defaultValue={(n.tags ?? []).join(', ')}
                    onBlur={(e) => {
                      const tags = e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean)
                      updateNote(n.id, { tags: tags.length ? tags : undefined })
                      refresh()
                    }}
                  />
                </label>
                <div className="book-card-actions">
                  <Link className="book-card-open-link" to={`/read/${n.bookId}/${n.chapterId}`}>
                    Open chapter
                  </Link>
                  <button
                    type="button"
                    className="book-card-open-link"
                    onClick={() => {
                      removeNote(n.id)
                      refresh()
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
