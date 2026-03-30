import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { jsPDF } from 'jspdf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const publicDir = path.join(repoRoot, 'public')
const libraryPath = path.join(publicDir, 'library.json')
const outRoot = path.join(repoRoot, 'Book Summaries')

// A4 layout
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = 100
const MARGIN_X = (PAGE_W - CONTENT_W) / 2
const MARGIN_Y = 18

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

function extractShortSummary(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''

  // Prefer sentence-based excerpt when punctuation exists.
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  const chosen = sentences.slice(0, 4).join(' ')
  if (chosen && chosen.length >= 120) return chosen

  // Fallback: first ~500 characters.
  return cleaned.slice(0, 520)
}

function flattenChapters(book) {
  const out = []
  for (const section of book.sections ?? []) {
    for (const ch of section.chapters ?? []) {
      if (ch?.file && ch?.title) out.push({ title: ch.title, file: ch.file })
    }
  }
  return out
}

async function exportBookSummaryPdf(book) {
  const chapters = flattenChapters(book)
  if (!chapters.length) return

  const first = chapters[0]
  const chapterAbsPath = path.join(publicDir, first.file)
  if (!fs.existsSync(chapterAbsPath)) {
    throw new Error(`Missing summary source for ${book.id}: ${first.file}`)
  }

  const text = await chapterTextFromFile(chapterAbsPath)
  const summary = extractShortSummary(text)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  // Header
  doc.setTextColor(34, 29, 22)
  doc.setFont('times', 'bold')
  doc.setFontSize(18)
  const titleLines = doc.splitTextToSize(book.title, CONTENT_W)
  let y = 24
  for (const line of titleLines) {
    doc.text(line, PAGE_W / 2, y, { align: 'center' })
    y += 7
  }

  // Subtitle (if any)
  if (book.subtitle) {
    doc.setFont('times', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(103, 95, 83)
    const subLines = doc.splitTextToSize(book.subtitle, CONTENT_W)
    for (const line of subLines) {
      doc.text(line, PAGE_W / 2, y, { align: 'center' })
      y += 5.2
    }
  }

  y += 6

  // Summary block
  doc.setFont('times', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(34, 29, 22)

  const summaryLabel = `Short summary · based on: ${first.title}`
  doc.setFont('times', 'bold')
  doc.setFontSize(10)
  doc.text(summaryLabel, MARGIN_X, y)
  y += 6
  doc.setFont('times', 'normal')

  const lines = doc.splitTextToSize(summary, CONTENT_W)
  const lineHeight = 6.1
  for (const line of lines) {
    if (y + lineHeight > PAGE_H - MARGIN_Y) {
      doc.addPage()
      y = MARGIN_Y + 10
    }
    doc.text(line, MARGIN_X, y)
    y += lineHeight
  }

  // Footer meta
  doc.setFont('times', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(103, 95, 83)
  doc.text(`Chapters: ${chapters.length}`, PAGE_W / 2, PAGE_H - 12, { align: 'center' })

  const bookDir = path.join(outRoot, book.id)
  fs.mkdirSync(bookDir, { recursive: true })
  const fileName = `${sanitizeFilename(book.title) || book.id}.pdf`
  const outPath = path.join(bookDir, fileName)

  const buf = Buffer.from(doc.output('arraybuffer'))
  fs.writeFileSync(outPath, buf)
  console.log(`[export-book-summaries] ${book.title} → ${path.relative(repoRoot, outPath)}`)
}

async function main() {
  if (!fs.existsSync(libraryPath)) {
    console.error(`[export-book-summaries] Missing ${libraryPath}. Run: npm run generate:library`)
    process.exitCode = 1
    return
  }

  const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8'))
  const books = library.books

  fs.mkdirSync(outRoot, { recursive: true })

  for (const book of books ?? []) {
    if (!book?.id || !book?.title) continue
    await exportBookSummaryPdf(book)
  }

  console.log(`[export-book-summaries] Done. Output root: ${path.relative(repoRoot, outRoot)}/`)
}

main().catch((err) => {
  console.error('[export-book-summaries]', err)
  process.exitCode = 1
})

