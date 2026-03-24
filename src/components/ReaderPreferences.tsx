import { useEffect, useMemo, useState } from 'react'
import { loadPrefs, savePrefs } from '../utils/readerStorage'

function applyToCSSVars(fontScale: number, lineHeight: number) {
  document.documentElement.style.setProperty(
    '--reader-font-scale',
    String(fontScale),
  )
  document.documentElement.style.setProperty(
    '--reader-line-height',
    String(lineHeight),
  )
}

export function ReaderPreferences() {
  const initial = useMemo(
    () => loadPrefs() ?? { fontScale: 1, lineHeight: 1.75 },
    [],
  )
  const [open, setOpen] = useState(false)
  const [fontScale, setFontScale] = useState(initial.fontScale)
  const [lineHeight, setLineHeight] = useState(initial.lineHeight)

  useEffect(() => {
    applyToCSSVars(fontScale, lineHeight)
  }, [fontScale, lineHeight])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function onSave() {
    savePrefs({ fontScale, lineHeight })
    setOpen(false)
  }

  function onReset() {
    setFontScale(1)
    setLineHeight(1.75)
  }

  return (
    <>
      <button
        type="button"
        className="theme-toggle pref-toggle"
        onClick={() => setOpen(true)}
        aria-label="Reading preferences"
      >
        Aa
      </button>

      {open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="pref-modal">
            <div className="pref-modal-head">
              <div className="pref-modal-title">Reading preferences</div>
              <button
                type="button"
                className="pref-modal-close"
                aria-label="Close preferences"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="pref-row">
              <div className="pref-label">
                Font size <span className="pref-value">{fontScale.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min={0.9}
                max={1.3}
                step={0.01}
                value={fontScale}
                onChange={(e) => setFontScale(parseFloat(e.target.value))}
              />
            </div>

            <div className="pref-row">
              <div className="pref-label">
                Line spacing{' '}
                <span className="pref-value">{lineHeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={1.4}
                max={2.1}
                step={0.05}
                value={lineHeight}
                onChange={(e) => setLineHeight(parseFloat(e.target.value))}
              />
            </div>

            <div className="pref-actions">
              <button type="button" className="pref-secondary" onClick={onReset}>
                Reset
              </button>
              <button type="button" className="pref-primary" onClick={onSave}>
                Save
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop-click"
            aria-label="Close preferences"
            onClick={() => setOpen(false)}
          />
        </div>
      ) : null}
    </>
  )
}

