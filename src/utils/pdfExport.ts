import { jsPDF } from 'jspdf'

/** A4 layout: narrow centered column (reader-like), white “page”, serif body. */
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = 100
const MARGIN_X = (PAGE_W - CONTENT_W) / 2
const MARGIN_Y = 18
const BODY_FONT_PT = 11
const BODY_LINE_MM = 6.1
const PARA_GAP_MM = 3.2
const TITLE_PT = 17
const TITLE_LINE_MM = 7.5
const SUBTITLE_PT = 10

const TEXT_RGB: [number, number, number] = [34, 29, 22]
const DOT_ACTIVE: [number, number, number] = [141, 110, 69]
const DOT_INACTIVE: [number, number, number] = [220, 218, 214]

function isDocx(path: string) {
  return path.toLowerCase().endsWith('.docx')
}

function urlFromPublicPath(publicPath: string): string {
  const trimmed = publicPath.replace(/^\/+/, '')
  if (!trimmed) return '/'
  return '/' + trimmed.split('/').map(encodeURIComponent).join('/')
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function markdownToText(md: string) {
  return md
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function fetchChapterText(publicPath: string): Promise<string> {
  const url = urlFromPublicPath(publicPath)
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load chapter (${res.status})`)

  if (isDocx(publicPath)) {
    const buf = await res.arrayBuffer()
    const mammoth = await import('mammoth')
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buf })
    return stripHtml(value)
  }

  const text = await res.text()
  return markdownToText(text)
}

function sanitizeFilename(name: string) {
  return name
    .replace(/[\/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/** Map chapter position to one of 7 dots (like the reader UI). */
function activeDotIndex(currentIndex: number, totalChapters: number) {
  if (totalChapters <= 1) return 0
  const max = 6
  return Math.min(max, Math.round((currentIndex / Math.max(totalChapters - 1, 1)) * max))
}

function drawProgressDots(doc: jsPDF, centerX: number, y: number, currentIndex: number, totalChapters: number) {
  const active = activeDotIndex(currentIndex, totalChapters)
  const count = 7
  const gap = 4.2
  const r = 0.85
  const totalW = (count - 1) * gap
  let x = centerX - totalW / 2
  for (let i = 0; i < count; i += 1) {
    const on = i === active
    doc.setFillColor(...(on ? DOT_ACTIVE : DOT_INACTIVE))
    doc.circle(x, y, r, 'F')
    x += gap
  }
}

function addBodyColumn(
  doc: jsPDF,
  text: string,
  startY: number,
): number {
  let y = startY
  doc.setTextColor(...TEXT_RGB)
  doc.setFont('Times', 'Normal')
  doc.setFontSize(BODY_FONT_PT)

  const paragraphs = text.split(/\n{2,}/)
  for (const p of paragraphs) {
    const trimmed = p.trim()
    if (!trimmed) {
      y += PARA_GAP_MM * 0.5
      continue
    }
    const lines = doc.splitTextToSize(trimmed, CONTENT_W) as string[]
    for (const line of lines) {
      if (y + BODY_LINE_MM > PAGE_H - MARGIN_Y) {
        doc.addPage()
        y = MARGIN_Y
        doc.setTextColor(...TEXT_RGB)
        doc.setFont('Times', 'Normal')
        doc.setFontSize(BODY_FONT_PT)
      }
      doc.text(line, MARGIN_X, y)
      y += BODY_LINE_MM
    }
    y += PARA_GAP_MM
  }
  return y
}

function renderReaderHeader(
  doc: jsPDF,
  args: {
    mainTitle: string
    subtitle?: string
    chapterIndex: number
    totalChapters: number
  },
) {
  const cx = PAGE_W / 2
  let y = 26

  doc.setTextColor(...TEXT_RGB)
  doc.setFont('Times', 'Bold')
  doc.setFontSize(TITLE_PT)
  const titleLines = doc.splitTextToSize(args.mainTitle, CONTENT_W) as string[]
  for (const line of titleLines) {
    doc.text(line, cx, y, { align: 'center' })
    y += TITLE_LINE_MM
  }

  if (args.subtitle) {
    doc.setFont('Times', 'Normal')
    doc.setFontSize(SUBTITLE_PT)
    doc.setTextColor(103, 95, 83)
    const subLines = doc.splitTextToSize(args.subtitle, CONTENT_W) as string[]
    for (const line of subLines) {
      doc.text(line, cx, y, { align: 'center' })
      y += 5.2
    }
    doc.setTextColor(...TEXT_RGB)
  }

  y += 4
  drawProgressDots(doc, cx, y + 1.2, args.chapterIndex, args.totalChapters)
  y += 10

  return y
}

export async function downloadChapterPdf(args: {
  bookTitle: string
  chapterTitle: string
  chapterPath: string
  chapterIndex: number
  totalChapters: number
}) {
  const text = await fetchChapterText(args.chapterPath)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  let y = renderReaderHeader(doc, {
    mainTitle: args.chapterTitle,
    subtitle: args.bookTitle,
    chapterIndex: args.chapterIndex,
    totalChapters: args.totalChapters,
  })

  y += 6
  addBodyColumn(doc, text, y)

  doc.save(`${sanitizeFilename(args.bookTitle)} - ${sanitizeFilename(args.chapterTitle)}.pdf`)
}

export async function downloadBookPdf(args: {
  bookTitle: string
  chapterItems: Array<{ title: string; path: string }>
  onProgress?: (current: number, total: number) => void
}) {
  const total = args.chapterItems.length
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  doc.setTextColor(...TEXT_RGB)
  doc.setFont('Times', 'Bold')
  doc.setFontSize(20)
  doc.text(args.bookTitle, PAGE_W / 2, 40, { align: 'center' })
  doc.setFont('Times', 'Normal')
  doc.setFontSize(10)
  doc.setTextColor(103, 95, 83)
  doc.text(`Full book · ${total} chapter${total === 1 ? '' : 's'}`, PAGE_W / 2, 50, { align: 'center' })
  doc.text(`Exported ${new Date().toLocaleDateString()}`, PAGE_W / 2, 56, { align: 'center' })
  doc.setTextColor(...TEXT_RGB)

  for (let i = 0; i < args.chapterItems.length; i += 1) {
    args.onProgress?.(i + 1, total)
    const ch = args.chapterItems[i]
    doc.addPage()
    let y = renderReaderHeader(doc, {
      mainTitle: ch.title,
      subtitle: args.bookTitle,
      chapterIndex: i,
      totalChapters: total,
    })
    y += 6
    const body = await fetchChapterText(ch.path)
    addBodyColumn(doc, body, y)
  }

  doc.save(`${sanitizeFilename(args.bookTitle)}.pdf`)
}
