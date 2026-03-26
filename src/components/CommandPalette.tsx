import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLibrary } from '../context/LibraryContext'
import { firstChapter } from '../utils/book'

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useLibrary()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const books = state.status === 'ready' ? state.data.books : []
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return books.slice(0, 8)
    return books
      .filter((b) => {
        const hay = `${b.title} ${b.subtitle ?? ''}`.toLowerCase()
        return hay.includes(s)
      })
      .slice(0, 12)
  }, [books, q])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Command palette">
      <button type="button" className="modal-backdrop-click" aria-label="Close" onClick={onClose} />
      <div className="command-palette pref-modal">
        <input
          className="command-palette-input"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Jump to a book…"
          aria-label="Search books"
        />
        <ul className="command-palette-list">
          {matches.map((b) => {
            const ch = firstChapter(b)
            const to = ch ? `/read/${b.id}/${ch.id}` : `/read/${b.id}`
            return (
              <li key={b.id}>
                <button
                  type="button"
                  className="command-palette-item"
                  onClick={() => {
                    navigate(to)
                    onClose()
                  }}
                >
                  <span className="command-palette-title">{b.title}</span>
                  {b.subtitle ? <span className="command-palette-sub muted small">{b.subtitle}</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="command-palette-hint muted small">
          Tip: open Notes from the header. Use the theme button for light / reading / dark.
        </p>
      </div>
    </div>
  )
}
