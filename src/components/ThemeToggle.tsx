import { useEffect, useState } from 'react'

type Theme = 'light' | 'reading' | 'dark'

const THEME_ORDER: Theme[] = ['light', 'reading', 'dark']

function getStored(): Theme | null {
  try {
    const v = localStorage.getItem('reader-theme')
    if (v === 'light' || v === 'reading' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return null
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    return getStored() ?? 'reading'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('reader-theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const nextTheme = (t: Theme) => {
    const idx = THEME_ORDER.indexOf(t)
    return THEME_ORDER[(idx + 1) % THEME_ORDER.length]
  }

  const icon = (() => {
    if (theme === 'dark') {
      return (
        <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3a1 1 0 0 1 1 1v1.1a7.9 7.9 0 0 1 6.8 6.8H21a1 1 0 1 1 0 2h-1.2a7.9 7.9 0 0 1-6.8 6.8V21a1 1 0 1 1-2 0v-1.2a7.9 7.9 0 0 1-6.8-6.8H3a1 1 0 1 1 0-2h1.2a7.9 7.9 0 0 1 6.8-6.8V4a1 1 0 0 1 1-1Z"
            fill="currentColor"
            opacity="0.18"
          />
          <path
            d="M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10Zm0-3h0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      )
    }
    if (theme === 'reading') {
      return (
        <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3a9 9 0 1 0 9 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M3.5 12h4.2c.6 0 1.1.5 1.1 1.1V18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M20.5 12h-4.2c-.6 0-1.1-.5-1.1-1.1V6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )
    }
    return (
      <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 18a6 6 0 1 0 0-12a6 6 0 0 0 0 12Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M19.7 4.3l-1.6 1.6M5.9 18.1l-1.6 1.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    )
  })()

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme((t) => nextTheme(t))}
      aria-label={`Switch to ${nextTheme(theme)} mode`}
    >
      {icon}
    </button>
  )
}
