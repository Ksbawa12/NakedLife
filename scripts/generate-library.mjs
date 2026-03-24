import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')
const storiesRoot = path.join(repoRoot, 'Stories')
const publicDir = path.resolve(__dirname, '../public')
const storiesLink = path.join(publicDir, 'Stories')
const outFile = path.join(publicDir, 'library.json')

function slugify(s) {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'item'
}

/** @param {string} basename without extension */
function extractPartNumber(basename) {
  const m = basename.match(/^Part\s+(\d+)\s+/i)
  return m ? parseInt(m[1], 10) : null
}

function ensureStoriesSymlink() {
  if (!fs.existsSync(storiesRoot)) {
    console.warn(`[generate-library] Stories folder not found: ${storiesRoot}`)
    return false
  }
  try {
    if (fs.existsSync(storiesLink)) {
      const stat = fs.lstatSync(storiesLink)
      if (stat.isSymbolicLink()) {
        return true
      }
      if (stat.isDirectory()) {
        console.warn(
          `[generate-library] ${storiesLink} exists and is not a symlink; remove it or link Stories manually.`,
        )
        return false
      }
    }
  } catch {
    /* ignore */
  }

  const target = path.relative(path.dirname(storiesLink), storiesRoot)
  fs.symlinkSync(target, storiesLink, 'dir')
  console.log(`[generate-library] Linked public/Stories → ${storiesRoot}`)
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

/**
 * Split manuscript rows into part groups (or one "Chapters" group).
 * @returns {{ sectionTitle: string, sectionKey: string, rows: object[] }[]}
 */
function partitionIntoPartGroups(docxFiles, storiesRoot) {
  const rows = docxFiles.map((full) => {
    const relFromStories = path.relative(storiesRoot, full).split(path.sep).join('/')
    const base = path.basename(full, path.extname(full))
    return { full, relFromStories, base, part: extractPartNumber(base) }
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

  const anyPartTag = rows.some((r) => r.part !== null)

  if (!anyPartTag) {
    const sorted = [...rows].sort(chapterOrderCompare)
    return [{ sectionTitle: 'Chapters', sectionKey: 'chapters', rows: sorted }]
  }

  const bucketByRow = rows.map((r) => ({
    ...r,
    bucket: r.part ?? 1,
  }))

  const bucketNums = [...new Set(bucketByRow.map((r) => r.bucket))].sort(
    (a, b) => a - b,
  )

  if (bucketNums.length === 1) {
    const sorted = [...rows].sort(chapterOrderCompare)
    return [{ sectionTitle: 'Chapters', sectionKey: 'chapters', rows: sorted }]
  }

  return bucketNums.map((num) => {
    const inBucket = bucketByRow.filter((r) => r.bucket === num)
    inBucket.sort(chapterOrderCompare)
    return {
      sectionTitle: `Part ${num}`,
      sectionKey: `part-${num}`,
      rows: inBucket,
    }
  })
}

async function chaptersFromRows(
  rows,
  bookEntryId,
  globalChapterIds,
  { nakedFamily = false, mammoth } = {},
) {
  const chapters = []
  for (const row of rows) {
    const { relFromStories, base, full } = row
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

    chapters.push({
      id,
      title,
      file: `Stories/${relFromStories}`,
    })
  }
  return chapters
}

async function main() {
  if (!fs.existsSync(storiesRoot)) {
    const fallback = {
      title: 'Naked Stories',
      books: [],
      _error: `Stories folder missing: ${storiesRoot}`,
    }
    fs.mkdirSync(publicDir, { recursive: true })
    fs.writeFileSync(outFile, JSON.stringify(fallback, null, 2))
    console.error(`[generate-library] ${fallback._error}`)
    process.exitCode = 1
    return
  }

  ensureStoriesSymlink()

  const bookDirs = fs
    .readdirSync(storiesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  const books = []
  const usedBookIds = new Set()
  const globalChapterIds = new Set()

  for (const folderName of bookDirs) {
    const bookDir = path.join(storiesRoot, folderName)
    const docxFiles = walkDocx(bookDir).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    )
    if (!docxFiles.length) continue

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
    const groups = partitionIntoPartGroups(docxFiles, storiesRoot)

    if (groups.length === 1) {
      let bookId = baseSlug
      let n = 1
      while (usedBookIds.has(bookId)) {
        bookId = `${baseSlug}-${n++}`
      }
      usedBookIds.add(bookId)

      let chapters = await chaptersFromRows(
        groups[0].rows,
        bookId,
        globalChapterIds,
        { nakedFamily, mammoth },
      )
      if (!chapters.length) continue

      if (nakedFamily) {
        let coverId = `${bookId}--cover`
        let k = 1
        while (globalChapterIds.has(coverId)) {
          coverId = `${bookId}--cover-${k++}`
        }
        globalChapterIds.add(coverId)

        chapters = [
          {
            id: coverId,
            title: 'Our Journey to Truth',
            file: 'books/naked-family-cover.md',
          },
          ...chapters,
        ]
      }

      books.push({
        id: bookId,
        title: folderName,
        manuscriptKey: baseSlug,
        sections: [
          {
            id: 'chapters',
            title: 'Chapters',
            chapters,
          },
        ],
      })
    } else {
      for (const g of groups) {
        let splitId = `${baseSlug}-${g.sectionKey}`
        let n = 1
        while (usedBookIds.has(splitId)) {
          splitId = `${baseSlug}-${g.sectionKey}-${n++}`
        }
        usedBookIds.add(splitId)

        const chapters = await chaptersFromRows(g.rows, splitId, globalChapterIds, {
          nakedFamily,
          mammoth,
        })
        if (!chapters.length) continue

        const partMatch = g.sectionKey.match(/^part-(\d+)$/)
        const partNumber = partMatch ? parseInt(partMatch[1], 10) : undefined

        books.push({
          id: splitId,
          title: folderName,
          subtitle: g.sectionTitle,
          manuscriptKey: baseSlug,
          partNumber,
          sections: [
            {
              id: 'chapters',
              title: 'Chapters',
              chapters,
            },
          ],
        })
      }
    }
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

void main()
