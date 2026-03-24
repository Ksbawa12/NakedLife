import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'

type Props = {
  path: string
  titleHint?: string
  onWordCount?: (count: number) => void
}

type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T }

function isDocx(path: string) {
  return path.toLowerCase().endsWith('.docx')
}

/** Path relative to `public/` (e.g. Stories/Book/file.docx); encodes spaces for fetch. */
function urlFromPublicPath(publicPath: string): string {
  const trimmed = publicPath.replace(/^\/+/, '')
  if (!trimmed) return '/'
  return '/' + trimmed.split('/').map(encodeURIComponent).join('/')
}

function wordCountFromText(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function wordCountFromHtml(html: string) {
  return wordCountFromText(html.replace(/<[^>]+>/g, ' '))
}

export function ChapterContent({ path, titleHint, onWordCount }: Props) {
  const url = urlFromPublicPath(path)

  if (isDocx(path)) {
    return (
      <DocxChapter
        url={url}
        rawPath={path}
        titleHint={titleHint}
        onWordCount={onWordCount}
      />
    )
  }

  return <TextChapter url={url} titleHint={titleHint} onWordCount={onWordCount} />
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/chapter\s*\d+/g, '')
    .replace(/part\s*\d+/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isLikelyDuplicateTitle(line: string, titleHint: string) {
  const left = normalizeTitle(line)
  const right = normalizeTitle(titleHint)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

function stripLeadingTitleFromMarkdown(text: string, titleHint?: string) {
  if (!titleHint) return text
  const lines = text.split('\n')
  let idx = 0
  while (idx < lines.length && !lines[idx].trim()) idx += 1
  if (idx >= lines.length) return text
  const first = lines[idx].replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '').trim()
  if (!isLikelyDuplicateTitle(first, titleHint)) return text
  lines.splice(idx, 1)
  while (idx < lines.length && !lines[idx].trim()) lines.splice(idx, 1)
  return lines.join('\n')
}

function stripLeadingTitleFromHtml(html: string, titleHint?: string) {
  if (!titleHint) return html
  const match = html.match(/^\s*<(h1|h2|h3|p)[^>]*>([\s\S]*?)<\/\1>/i)
  if (!match) return html
  const full = match[0]
  const inner = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!isLikelyDuplicateTitle(inner, titleHint)) return html
  return html.slice(full.length).replace(/^\s+/, '')
}

function TextChapter({
  url,
  titleHint,
  onWordCount,
}: {
  url: string
  titleHint?: string
  onWordCount?: (count: number) => void
}) {
  const [state, setState] = useState<AsyncState<string>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    void (async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed to load chapter (${res.status})`)
        const text = await res.text()
        const cleaned = stripLeadingTitleFromMarkdown(text, titleHint)
        onWordCount?.(wordCountFromText(cleaned))
        if (!cancelled) setState({ status: 'ready', data: cleaned })
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : 'Could not load chapter'
          setState({ status: 'error', message })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url, attempt, titleHint, onWordCount])

  if (state.status === 'loading')
    return (
      <div className="prose-skeleton" aria-label="Loading chapter">
        <div className="skeleton-line" />
        <div className="skeleton-line w-95" />
        <div className="skeleton-line w-85" />
        <div className="skeleton-line w-90" />
        <div className="skeleton-line w-65" />
        <div className="skeleton-line w-75" />
      </div>
    )
  if (state.status === 'error')
    return (
      <div className="chapter-error">
        <p className="error">{state.message}</p>
        <button
          type="button"
          className="read-retry"
          onClick={() => setAttempt((a) => a + 1)}
        >
          Retry
        </button>
      </div>
    )

  return (
    <article className="prose">
      <Markdown>{state.data}</Markdown>
    </article>
  )
}

function DocxChapter({
  url,
  rawPath,
  titleHint,
  onWordCount,
}: {
  url: string
  rawPath: string
  titleHint?: string
  onWordCount?: (count: number) => void
}) {
  const [state, setState] = useState<AsyncState<string>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    void (async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed to load chapter (${res.status})`)
        const buf = await res.arrayBuffer()
        const mammoth = await import('mammoth')
        const { value } = await mammoth.convertToHtml({ arrayBuffer: buf })
        let html = value

        // Naked Family has some introduction material embedded in `0.docx`.
        // User asked to remove that introduction section from chapter 0.
        if (rawPath.endsWith('Stories/Naked Family/0.docx')) {
          html = html.replace(
            /<p><strong>\s*Introduction:\s*The Myth of the Bathroom\s*<\/strong><\/p>[\s\S]*$/i,
            '',
          )
        }

        const cleaned = stripLeadingTitleFromHtml(html, titleHint)
        onWordCount?.(wordCountFromHtml(cleaned))
        if (!cancelled) setState({ status: 'ready', data: cleaned })
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : 'Could not load chapter'
          setState({ status: 'error', message })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url, attempt, rawPath, titleHint, onWordCount])

  if (state.status === 'loading')
    return (
      <div className="prose-skeleton" aria-label="Loading chapter">
        <div className="skeleton-line" />
        <div className="skeleton-line w-95" />
        <div className="skeleton-line w-85" />
        <div className="skeleton-line w-90" />
        <div className="skeleton-line w-65" />
        <div className="skeleton-line w-75" />
      </div>
    )
  if (state.status === 'error')
    return (
      <div className="chapter-error">
        <p className="error">{state.message}</p>
        <button
          type="button"
          className="read-retry"
          onClick={() => setAttempt((a) => a + 1)}
        >
          Retry
        </button>
      </div>
    )

  return (
    <article
      className="prose prose-docx"
      dangerouslySetInnerHTML={{ __html: state.data }}
    />
  )
}
