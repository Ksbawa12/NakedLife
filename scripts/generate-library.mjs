import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
/** Manuscripts live in repo-root Books/ — exposed to the dev server via public/Books → ../Books */
const booksRoot = path.join(repoRoot, 'Books')

const publicDir = path.resolve(__dirname, '../public')
const booksLink = path.join(publicDir, 'Books')
const outFile = path.join(publicDir, 'library.json')

function slugify(s) {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'item'
}

function displayTitleForFolder(folderName) {
  if (folderName.trim().toLowerCase() === 'the unveiled life') {
    return 'The Unveiled Life - How to Become a Nudist'
  }
  return folderName
}

/** @param {string} basename without extension */
function extractPartNumber(basename) {
  const m = basename.match(/^Part\s+(\d+)\s+/i)
  return m ? parseInt(m[1], 10) : null
}

function ensureBooksSymlink() {
  if (!fs.existsSync(booksRoot)) {
    console.error(`[generate-library] Books folder not found: ${booksRoot}`)
    return false
  }
  const target = path.relative(path.dirname(booksLink), booksRoot).split(path.sep).join('/')

  try {
    const stat = fs.lstatSync(booksLink)
    if (stat.isSymbolicLink()) {
      const resolvedCurrent = path.resolve(path.dirname(booksLink), fs.readlinkSync(booksLink))
      const resolvedWant = path.resolve(booksRoot)
      if (resolvedCurrent === resolvedWant) {
        return true
      }
      fs.unlinkSync(booksLink)
    } else if (stat.isDirectory()) {
      console.warn(
        `[generate-library] ${booksLink} exists and is not a symlink; remove it or link Books manually.`,
      )
      return false
    }
  } catch (e) {
    if (e && e.code !== 'ENOENT') {
      console.warn('[generate-library] ensureBooksSymlink:', e)
    }
  }

  try {
    fs.symlinkSync(target, booksLink, 'dir')
    console.log(`[generate-library] Linked public/Books → ${booksRoot}`)
  } catch (e) {
    console.warn('[generate-library] could not create public/Books symlink:', e.message)
    return false
  }
  return true
}

function walkDocx(dir) {
  const out = []
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...walkDocx(full))
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.docx')) {
      out.push(full)
    }
  }
  return out
}

let _mammoth = null

async function getMammoth() {
  if (_mammoth) return _mammoth
  const mod = await import('mammoth')
  _mammoth = mod.default ?? mod
  return _mammoth
}

function stripHtmlToLines(html) {
  return html
    .replace(/<[^>]+>/g, '\n')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

async function nakedFamilyChapterDisplayTitle({ mammoth, fullPath, base }) {
  const { value } = await mammoth.convertToHtml({ path: fullPath })
  const lines = stripHtmlToLines(value)

  const baseLower = base.toLowerCase()
  if (baseLower === 'introduction') {
    const first = lines[0] ?? 'Introduction'
    const m = first.match(/^Introduction:\s*(.*)$/i)
    const titlePart = m?.[1]?.trim()
    return titlePart ? `Introduction ${titlePart}` : 'Introduction'
  }

  const digits = base.match(/^\d+$/)
  if (!digits) return base

  const chapterNumber = parseInt(base, 10)
  const candidate =
    lines.find(
      (l) =>
        !l.endsWith(':') &&
        l.length <= 90 &&
        !/^By:$/i.test(l) &&
        !/^About the Book$/i.test(l),
    ) ?? base

  return `Chapter ${chapterNumber} ${candidate}`
}

function partitionIntoPartGroups(docxFiles, rootDir) {
  const rows = docxFiles.map((full) => {
    const relFromBooks = path.relative(rootDir, full).split(path.sep).join('/')
    const base = path.basename(full, path.extname(full))
    return { full, relFromBooks, base, part: extractPartNumber(base) }
  })

  function chapterOrderCompare(a, b) {
    const aBase = a.base
    const bBase = b.base

    const aIntro = /^introduction$/i.test(aBase)
    const bIntro = /^introduction$/i.test(bBase)
    if (aIntro !== bIntro) return aIntro ? -1 : 1

    const aConclusion = /^conclusion$/i.test(aBase)
    const bConclusion = /^conclusion$/i.test(bBase)
    if (aConclusion !== bConclusion) return aConclusion ? 1 : -1

    const aDigits = aBase.match(/^\d+$/)
    const bDigits = bBase.match(/^\d+$/)
    if (aDigits && bDigits) return parseInt(aDigits[0], 10) - parseInt(bDigits[0], 10)

    return aBase.localeCompare(bBase, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  }

  const sorted = [...rows].sort((a, b) => {
    const aPart = a.part ?? 1
    const bPart = b.part ?? 1
    if (aPart !== bPart) return aPart - bPart
    return chapterOrderCompare(a, b)
  })
  return [{ sectionTitle: 'Chapters', sectionKey: 'chapters', rows: sorted }]
}

function normalizeChapterTitleSequential(title, seq) {
  const t = title.trim()
  const m = t.match(/^(?:Part\s+\d+\s+)?Chapter\s+\d+\s*(.*)$/i)
  if (!m) return t
  const suffix = (m[1] || '').trim()
  return suffix ? `Chapter ${seq} ${suffix}` : `Chapter ${seq}`
}

async function chaptersFromRows(
  rows,
  bookEntryId,
  globalChapterIds,
  { nakedFamily = false, mammoth, renumberSequential = false } = {},
) {
  const chapters = []
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const { relFromBooks, base, full } = row
    const baseSlug = slugify(base)
    let id = `${bookEntryId}--${baseSlug}`
    let n = 1
    while (globalChapterIds.has(id)) {
      id = `${bookEntryId}--${baseSlug}-${n}`
      n += 1
    }
    globalChapterIds.add(id)

    let title = base
    if (nakedFamily) {
      title = await nakedFamilyChapterDisplayTitle({
        mammoth,
        fullPath: full,
        base,
      })
    }
    if (renumberSequential) {
      title = normalizeChapterTitleSequential(title, i + 1)
    }

    chapters.push({
      id,
      title,
      file: `Books/${relFromBooks}`,
    })
  }
  return chapters
}

async function main() {
  if (!fs.existsSync(booksRoot)) {
    console.error('[generate-library] No Books/ directory at repo root.')
    process.exitCode = 1
    return
  }
  ensureBooksSymlink()

  const bookDirs = fs
    .readdirSync(booksRoot, { withFileTypes: true })
    .filter((d) => {
      if (d.name.startsWith('.')) return false
      try {
        return fs.statSync(path.join(booksRoot, d.name)).isDirectory()
      } catch {
        return false
      }
    })
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  const books = []
  const usedBookIds = new Set()
  const globalChapterIds = new Set()

  for (const folderName of bookDirs) {
    const bookDir = path.join(booksRoot, folderName)
    const docxFiles = walkDocx(bookDir).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    )
    if (!docxFiles.length) continue
    const latestAddedAt = docxFiles.reduce((maxTs, fullPath) => {
      try {
        const ts = fs.statSync(fullPath).mtimeMs || 0
        return ts > maxTs ? ts : maxTs
      } catch {
        return maxTs
      }
    }, 0)

    const nakedFamily = folderName.trim().toLowerCase() === 'naked family'
    const mammoth = nakedFamily ? await getMammoth() : undefined

    if (nakedFamily) {
      docxFiles.sort((a, b) => {
        const abase = path.basename(a, path.extname(a))
        const bbase = path.basename(b, path.extname(b))
        const aIntro = /^introduction$/i.test(abase)
        const bIntro = /^introduction$/i.test(bbase)
        if (aIntro && !bIntro) return -1
        if (!aIntro && bIntro) return 1
        return abase.localeCompare(bbase, undefined, { numeric: true })
      })
    }

    const baseSlug = slugify(folderName)
    const groups = partitionIntoPartGroups(docxFiles, booksRoot)

    let bookId = baseSlug
    let n = 1
    while (usedBookIds.has(bookId)) {
      bookId = `${baseSlug}-${n++}`
    }
    usedBookIds.add(bookId)

    const sections = []
    for (const g of groups) {
      const chapters = await chaptersFromRows(g.rows, bookId, globalChapterIds, {
        nakedFamily,
        mammoth,
        renumberSequential: true,
      })
      if (!chapters.length) continue
      sections.push({
        id: g.sectionKey,
        title: g.sectionTitle,
        chapters,
      })
    }
    if (!sections.length) continue

    books.push({
      id: bookId,
      title: displayTitleForFolder(folderName),
      manuscriptKey: baseSlug,
      latestAddedAt,
      sections,
    })
  }

  const library = {
    title: 'Naked Stories',
    books,
  }

  const chapterTotal = books.reduce(
    (a, b) => a + b.sections.reduce((n, s) => n + s.chapters.length, 0),
    0,
  )

  fs.mkdirSync(publicDir, { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(library, null, 2))
  console.log(
    `[generate-library] Wrote ${books.length} library entries (${chapterTotal} chapters) → public/library.json`,
  )
}

main().catch((err) => {
  console.error('[generate-library]', err)
  process.exitCode = 1
})
