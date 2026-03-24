import type { Book, Chapter, Section } from '../types/library'

export type ChapterInOrder = {
  section: Section
  chapter: Chapter
}

/** Flat chapter list in sidebar / file order. */
export function chaptersInOrder(book: Book): ChapterInOrder[] {
  const out: ChapterInOrder[] = []
  for (const section of book.sections) {
    for (const chapter of section.chapters) {
      out.push({ section, chapter })
    }
  }
  return out
}

export type ManuscriptGroup = {
  manuscriptKey: string
  books: Book[]
}

/** One group per manuscript folder; multi-part works contain several `Book` entries. */
export function groupBooksByManuscript(books: Book[]): ManuscriptGroup[] {
  const map = new Map<string, Book[]>()
  for (const b of books) {
    const k = b.manuscriptKey
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(b)
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.partNumber ?? 0) - (b.partNumber ?? 0))
  }
  return [...map.keys()]
    .sort((ka, kb) => {
      const ta = map.get(ka)![0].title
      const tb = map.get(kb)![0].title
      return ta.localeCompare(tb, undefined, { sensitivity: 'base' })
    })
    .map((manuscriptKey) => ({ manuscriptKey, books: map.get(manuscriptKey)! }))
}

/** Flat list of one-part manuscripts, plus each multi-part manuscript as its own group. */
export function partitionSinglesAndSeries(groups: ManuscriptGroup[]): {
  singles: Book[]
  series: ManuscriptGroup[]
} {
  const singles: Book[] = []
  const series: ManuscriptGroup[] = []
  for (const g of groups) {
    if (g.books.length === 1) {
      singles.push(g.books[0])
    } else {
      series.push(g)
    }
  }
  singles.sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  )
  return { singles, series }
}

export function bookChapterCount(book: Book): number {
  return book.sections.reduce((n, s) => n + s.chapters.length, 0)
}

export function firstChapter(book: Book): Chapter | undefined {
  return book.sections[0]?.chapters[0]
}

export function findChapter(
  book: Book,
  chapterId: string,
): { section: Section; chapter: Chapter } | undefined {
  for (const section of book.sections) {
    const chapter = section.chapters.find((c) => c.id === chapterId)
    if (chapter) return { section, chapter }
  }
  return undefined
}

export function hasChapter(book: Book, chapterId: string): boolean {
  return findChapter(book, chapterId) !== undefined
}

/**
 * Drop leading "Part N …" when the sidebar/header already shows Part N
 * (section title or book subtitle from a split library card).
 */
export function chapterDisplayTitle(
  section: Section,
  chapter: Chapter,
  bookSubtitle?: string,
): string {
  const partMatch =
    bookSubtitle?.match(/^Part (\d+)$/i) ?? section.title.match(/^Part (\d+)$/i)
  if (!partMatch) return chapter.title
  const n = partMatch[1]
  const stripped = chapter.title.replace(
    new RegExp(`^Part\\s+${n}\\s+`, 'i'),
    '',
  )
  return stripped.trim() || chapter.title
}
