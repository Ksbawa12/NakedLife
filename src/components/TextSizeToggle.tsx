import { useCallback, useEffect, useState } from 'react'
import { loadPrefs, savePrefs } from '../utils/readerStorage'

const MIN_SCALE = 0.72
const MAX_SCALE = 1.56
const STEP = 0.04

function clampScale(n: number) {
  const stepped = Math.round(n / STEP) * STEP
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(stepped * 100) / 100))
}

function applyScaleToDom(scale: number, lineHeight: number) {
  document.documentElement.style.setProperty('--reader-font-scale', String(scale))
  document.documentElement.style.setProperty('--reader-line-height', String(lineHeight))
}

export function TextSizeToggle() {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const prefs = loadPrefs()
    const raw = prefs?.fontScale ?? 1
    const lineHeight = prefs?.lineHeight ?? 1.75
    const next = clampScale(raw)
    setScale(next)
    applyScaleToDom(next, lineHeight)
    if (next !== raw) {
      savePrefs({ ...(prefs ?? { fontScale: 1, lineHeight: 1.75 }), fontScale: next })
    }
  }, [])

  const persist = useCallback((nextScale: number) => {
    const s = clampScale(nextScale)
    setScale(s)
    const prefs = loadPrefs() ?? { fontScale: 1, lineHeight: 1.75 }
    savePrefs({ ...prefs, fontScale: s })
    applyScaleToDom(s, prefs.lineHeight)
  }, [])

  const dec = useCallback(() => persist(scale - STEP), [persist, scale])
  const inc = useCallback(() => persist(scale + STEP), [persist, scale])
  const reset = useCallback(() => persist(1), [persist])

  const pct = Math.round(scale * 100)
  const atMin = scale <= MIN_SCALE + 0.001
  const atMax = scale >= MAX_SCALE - 0.001

  return (
    <div className="text-size-toggle" role="group" aria-label="Text size">
      <button
        type="button"
        className="text-size-btn text-size-btn--step text-size-btn--minus"
        onClick={dec}
        disabled={atMin}
        aria-label="Smaller text"
        title="Smaller"
      >
        −
      </button>
      <button
        type="button"
        className="text-size-readout"
        onClick={reset}
        title="Reset to default (100%)"
        aria-label={`Text size ${pct} percent. Click to reset to 100 percent.`}
      >
        {pct}%
      </button>
      <button
        type="button"
        className="text-size-btn text-size-btn--step text-size-btn--plus"
        onClick={inc}
        disabled={atMax}
        aria-label="Larger text"
        title="Larger"
      >
        +
      </button>
    </div>
  )
}
