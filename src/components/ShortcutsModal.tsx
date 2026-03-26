import { useEffect } from 'react'

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <button type="button" className="modal-backdrop-click" aria-label="Close" onClick={onClose} />
      <div className="pref-modal">
        <div className="pref-modal-head">
          <div className="pref-modal-title">Shortcuts</div>
          <button type="button" className="pref-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <ul className="shortcuts-list">
          <li>
            <kbd className="kbd">⌘</kbd> / <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">K</kbd>{' '}
            <span className="muted">Command palette (jump to book)</span>
          </li>
          <li>
            <kbd className="kbd">?</kbd> <span className="muted">This help</span>
          </li>
          <li>
            <kbd className="kbd">/</kbd> <span className="muted">Focus library search (home)</span>
          </li>
          <li>
            <kbd className="kbd">Esc</kbd> <span className="muted">Clear library search</span>
          </li>
          <li>
            <span className="muted">Reader: find-in-chapter bar, outline, and ruler in the top tools row</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
