import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { jsPDF } from 'jspdf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const publicDir = path.join(repoRoot, 'public')
const libraryPath = path.join(publicDir, 'library.json')
const outRoot = path.join(repoRoot, 'Book Chapter Summaries')

// A4 layout
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = 110
const MARGIN_X = (PAGE_W - CONTENT_W) / 2
const MARGIN_Y = 18
const BODY_FONT_PT = 10.8
const BODY_LINE_MM = 5.6
const PARA_GAP_MM = 3.0

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
    .slice(0, 140)
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
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  const chosen = sentences.slice(0, 4).join(' ')
  if (chosen && chosen.length >= 120) return chosen.slice(0, 720)
  return cleaned.slice(0, 720)
}

function flattenChapters(book) {
  const out = []
  for (const section of book.sections ?? []) {
    for (const ch of section.chapters ?? []) {
      if (ch?.file && ch?.title) out.push({ title: ch.title, file: ch.file, section: section.title })
    }
  }
  return out
}

function ensurePageSpace(doc, y, needed) {
  if (y + needed <= PAGE_H - MARGIN_Y) return y
  doc.addPage()
  return MARGIN_Y
}

function writeWrapped(doc, text, x, y, options = {}) {
  const lines = doc.splitTextToSize(text, CONTENT_W)
  for (const line of lines) {
    y = ensurePageSpace(doc, y, BODY_LINE_MM)
    doc.text(line, x, y, options)
    y += BODY_LINE_MM
  }
  return y
}

async function exportBookChapterSummariesPdf(book) {
  const chapters = flattenChapters(book)
  if (!chapters.length) return

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setTextColor(34, 29, 22)

  // Cover page
  doc.setFont('times', 'bold')
  doc.setFontSize(20)
  const titleLines = doc.splitTextToSize(book.title, CONTENT_W)
  let y = 34
  for (const line of titleLines) {
    doc.text(line, PAGE_W / 2, y, { align: 'center' })
    y += 8
  }
  if (book.subtitle) {
    doc.setFont('times', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(103, 95, 83)
    const subLines = doc.splitTextToSize(book.subtitle, CONTENT_W)
    for (const line of subLines) {
      doc.text(line, PAGE_W / 2, y, { align: 'center' })
      y += 5.3
    }
    doc.setTextColor(34, 29, 22)
  }
  y += 6
  doc.setFont('times', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(103, 95, 83)
  doc.text(`Chapter summaries · ${chapters.length} chapters`, PAGE_W / 2, y, { align: 'center' })
  y += 5
  doc.text(`Exported ${new Date().toLocaleDateString()}`, PAGE_W / 2, y, { align: 'center' })
  doc.setTextColor(34, 29, 22)

  // Per-chapter pages
  for (let i = 0; i < chapters.length; i += 1) {
    const ch = chapters[i]
    const chapterAbsPath = path.join(publicDir, ch.file)
    if (!fs.existsSync(chapterAbsPath)) {
      throw new Error(`Missing manuscript file for ${book.id}: ${ch.file}`)
    }
    const fullText = await chapterTextFromFile(chapterAbsPath)
    const summary = extractShortSummary(fullText)

    doc.addPage()
    let cy = MARGIN_Y

    doc.setFont('times', 'bold')
    doc.setFontSize(14)
    cy = writeWrapped(doc, ch.title, MARGIN_X, cy)
    cy += 1.5

    doc.setFont('times', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(103, 95, 83)
    cy = writeWrapped(doc, `${book.title} · ${ch.section} · ${i + 1}/${chapters.length}`, MARGIN_X, cy)
    doc.setTextColor(34, 29, 22)
    cy += 4.5

    doc.setFont('times', 'normal')
    doc.setFontSize(BODY_FONT_PT)
    cy = writeWrapped(doc, summary || '(No text found.)', MARGIN_X, cy)
    cy += PARA_GAP_MM
  }

  const bookDir = path.join(outRoot, book.id)
  fs.mkdirSync(bookDir, { recursive: true })
  const fileName = `${sanitizeFilename(book.title) || book.id} - Chapter Summaries.pdf`
  const outPath = path.join(bookDir, fileName)
  const buf = Buffer.from(doc.output('arraybuffer'))
  fs.writeFileSync(outPath, buf)
  console.log(
    `[export-book-chapter-summaries] ${book.title} → ${path.relative(repoRoot, outPath)}`,
  )
}

async function main() {
  if (!fs.existsSync(libraryPath)) {
    console.error(
      `[export-book-chapter-summaries] Missing ${libraryPath}. Run: npm run generate:library`,
    )
    process.exitCode = 1
    return
  }

  const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8'))
  const books = library.books

  fs.mkdirSync(outRoot, { recursive: true })

  for (const book of books ?? []) {
    if (!book?.id || !book?.title) continue
    await exportBookChapterSummariesPdf(book)
  }

  console.log(
    `[export-book-chapter-summaries] Done. Output root: ${path.relative(repoRoot, outRoot)}/`,
  )
}

main().catch((err) => {
  console.error('[export-book-chapter-summaries]', err)
  process.exitCode = 1
})

