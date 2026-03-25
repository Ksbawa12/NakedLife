import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useLibrary } from '../context/LibraryContext'
import { chapterDisplayTitle, findChapter } from '../utils/book'
import { loadNotes, removeNote } from '../utils/readerStorage'

export function NotesPage() {
  const { state } = useLibrary()
  const notes = loadNotes()

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

  return (
    <main className="page library-page">
      <header className="library-header">
        <h1>Notes</h1>
        <p className="muted">All highlights and notes in one place</p>
      </header>

      {!items.length ? (
        <section className="library-section library-empty-card">
          <p className="library-empty muted">No saved notes yet.</p>
          <Link className="library-empty-cta" to="/">
            Back to library
          </Link>
        </section>
      ) : (
        <section className="library-section">
          <ul className="read-notes-list">
            {items.map((n) => (
              <li key={n.id} className="read-note-item">
                <p className="small muted">{n.bookTitle} · {n.chapterTitle}</p>
                <p>"{n.text}"</p>
                {n.note ? <p className="muted small">{n.note}</p> : null}
                <div className="book-card-actions">
                  <Link className="book-card-open-link" to={`/read/${n.bookId}/${n.chapterId}`}>
                    Open chapter
                  </Link>
                  <button
                    type="button"
                    className="book-card-open-link"
                    onClick={() => {
                      removeNote(n.id)
                      window.location.reload()
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
