import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { jsPDF } from 'jspdf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const publicDir = path.join(repoRoot, 'public')
const libraryPath = path.join(publicDir, 'library.json')
const outRoot = path.join(repoRoot, 'Book PDFs')

/** A4 layout — aligned with src/utils/pdfExport.ts */
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
const TEXT_RGB = [34, 29, 22]
const DOT_ACTIVE = [141, 110, 69]
const DOT_INACTIVE = [220, 218, 214]

function isDocx(p) {
  return p.toLowerCase().endsWith('.docx')
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function markdownToText(md) {
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

function sanitizeFilename(name) {
  return name
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

let _mammoth = null
async function getMammoth() {
  if (_mammoth) return _mammoth
  const mod = await import('mammoth')
  _mammoth = mod.default ?? mod
  return _mammoth
}

async function chapterTextFromFile(absPath) {
  if (isDocx(absPath)) {
    const mammoth = await getMammoth()
    const { value } = await mammoth.convertToHtml({ path: absPath })
    return stripHtml(value)
  }
  const raw = fs.readFileSync(absPath, 'utf8')
  return markdownToText(raw)
}

function activeDotIndex(currentIndex, totalChapters) {
  if (totalChapters <= 1) return 0
  const max = 6
  return Math.min(max, Math.round((currentIndex / Math.max(totalChapters - 1, 1)) * max))
}

function drawProgressDots(doc, centerX, y, currentIndex, totalChapters) {
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

function addBodyColumn(doc, text, startY) {
  let y = startY
  doc.setTextColor(...TEXT_RGB)
  doc.setFont('times', 'normal')
  doc.setFontSize(BODY_FONT_PT)

  const paragraphs = text.split(/\n{2,}/)
  for (const p of paragraphs) {
    const trimmed = p.trim()
    if (!trimmed) {
      y += PARA_GAP_MM * 0.5
      continue
    }
    const lines = doc.splitTextToSize(trimmed, CONTENT_W)
    for (const line of lines) {
      if (y + BODY_LINE_MM > PAGE_H - MARGIN_Y) {
        doc.addPage()
        y = MARGIN_Y
        doc.setTextColor(...TEXT_RGB)
        doc.setFont('times', 'normal')
        doc.setFontSize(BODY_FONT_PT)
      }
      doc.text(line, MARGIN_X, y)
      y += BODY_LINE_MM
    }
    y += PARA_GAP_MM
  }
  return y
}

function renderReaderHeader(doc, args) {
  const cx = PAGE_W / 2
  let y = 26

  doc.setTextColor(...TEXT_RGB)
  doc.setFont('times', 'bold')
  doc.setFontSize(TITLE_PT)
  const titleLines = doc.splitTextToSize(args.mainTitle, CONTENT_W)
  for (const line of titleLines) {
    doc.text(line, cx, y, { align: 'center' })
    y += TITLE_LINE_MM
  }

  if (args.subtitle) {
    doc.setFont('times', 'normal')
    doc.setFontSize(SUBTITLE_PT)
    doc.setTextColor(103, 95, 83)
    const subLines = doc.splitTextToSize(args.subtitle, CONTENT_W)
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

function flattenChapters(book) {
  const items = []
  for (const section of book.sections ?? []) {
    for (const ch of section.chapters ?? []) {
      if (ch?.file && ch?.title) items.push({ title: ch.title, rel: ch.file })
    }
  }
  return items
}

function resolvePublicFile(rel) {
  const normalized = rel.split('/').join(path.sep)
  const abs = path.join(publicDir, normalized)
  return path.normalize(abs)
}

async function buildBookPdf(book) {
  const items = flattenChapters(book)
  if (!items.length) {
    console.warn(`[export-book-pdfs] skip ${book.id}: no chapters`)
    return
  }

  const total = items.length
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  doc.setTextColor(...TEXT_RGB)
  doc.setFont('times', 'bold')
  doc.setFontSize(20)
  doc.text(book.title, PAGE_W / 2, 40, { align: 'center' })
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(103, 95, 83)
  doc.text(`Full book · ${total} chapter${total === 1 ? '' : 's'}`, PAGE_W / 2, 50, { align: 'center' })
  doc.text(`Exported ${new Date().toLocaleDateString()}`, PAGE_W / 2, 56, { align: 'center' })
  doc.setTextColor(...TEXT_RGB)

  for (let i = 0; i < items.length; i += 1) {
    const ch = items[i]
    const abs = resolvePublicFile(ch.rel)
    if (!fs.existsSync(abs)) {
      throw new Error(`Missing manuscript file for ${book.id}: ${ch.rel} (expected ${abs})`)
    }
    doc.addPage()
    let y = renderReaderHeader(doc, {
      mainTitle: ch.title,
      subtitle: book.title,
      chapterIndex: i,
      totalChapters: total,
    })
    y += 6
    const body = await chapterTextFromFile(abs)
    addBodyColumn(doc, body, y)
  }

  const bookDir = path.join(outRoot, book.id)
  fs.mkdirSync(bookDir, { recursive: true })
  const fileName = `${sanitizeFilename(book.title) || book.id}.pdf`
  const outPath = path.join(bookDir, fileName)
  const buf = Buffer.from(doc.output('arraybuffer'))
  fs.writeFileSync(outPath, buf)
  console.log(`[export-book-pdfs] ${book.title} → ${path.relative(repoRoot, outPath)}`)
}

async function main() {
  if (!fs.existsSync(libraryPath)) {
    console.error(`[export-book-pdfs] Missing ${libraryPath}. Run: npm run generate:library`)
    process.exitCode = 1
    return
  }

  const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8'))
  const books = library.books
  if (!Array.isArray(books) || !books.length) {
    console.error('[export-book-pdfs] library.json has no books')
    process.exitCode = 1
    return
  }

  fs.mkdirSync(outRoot, { recursive: true })

  for (const book of books) {
    if (!book?.id || !book?.title) continue
    try {
      await buildBookPdf(book)
    } catch (err) {
      console.error(`[export-book-pdfs] failed ${book.id}:`, err.message || err)
      process.exitCode = 1
    }
  }

  console.log(`[export-book-pdfs] Done. Output root: ${path.relative(repoRoot, outRoot)}/`)
}

main().catch((err) => {
  console.error('[export-book-pdfs]', err)
  process.exitCode = 1
})
