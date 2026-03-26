export type ReaderProgress = {
  bookId: string
  chapterId: string
  updatedAt: number
  scrollY: number
}

export type ReaderPrefs = {
  fontScale: number
  lineHeight: number
}

export type ReaderBookmark = {
  bookId: string
  chapterId: string
  createdAt: number
  scrollY: number
}

export type ReaderNote = {
  id: string
  bookId: string
  chapterId: string
  text: string
  note?: string
  kind?: 'highlight' | 'note'
  color?: 'sand' | 'gold' | 'mint' | 'sky' | 'rose'
  tags?: string[]
  createdAt: number
}

export type ReaderSession = {
  day: string
  minutes: number
}

const PROGRESS_KEY = 'reader-progress-v1'
const PREFS_KEY = 'reader-prefs-v1'
const BOOKMARKS_KEY = 'reader-bookmarks-v1'
const COVER_OVERRIDES_KEY = 'reader-cover-overrides-v1'
const NOTES_KEY = 'reader-notes-v1'
const SESSIONS_KEY = 'reader-sessions-v1'
const PINNED_BOOKS_KEY = 'reader-pinned-books-v1'
const LIBRARY_VIEW_KEY = 'library-view-v1'

export type LibraryViewState = {
  sortMode: string
  chip: string
}

function safeParseJSON<T>(s: string | null): T | undefined {
  if (!s) return undefined
  try {
    return JSON.parse(s) as T
  } catch {
    return undefined
  }
}

export function loadPrefs(): ReaderPrefs | undefined {
  if (typeof window === 'undefined') return undefined
  return safeParseJSON<ReaderPrefs>(window.localStorage.getItem(PREFS_KEY))
}

export function savePrefs(prefs: ReaderPrefs) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export function loadProgressMap(): Record<string, ReaderProgress> {
  if (typeof window === 'undefined') return {}
  return (
    safeParseJSON<Record<string, ReaderProgress>>(
      window.localStorage.getItem(PROGRESS_KEY),
    ) ?? {}
  )
}

export function saveProgress(progress: ReaderProgress) {
  if (typeof window === 'undefined') return
  const map = loadProgressMap()
  map[progress.bookId] = progress
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(map))
}

export function loadBookmarks(): ReaderBookmark[] {
  if (typeof window === 'undefined') return []
  return safeParseJSON<ReaderBookmark[]>(
    window.localStorage.getItem(BOOKMARKS_KEY),
  ) ?? []
}

export function upsertBookmark(bm: ReaderBookmark) {
  if (typeof window === 'undefined') return
  const list = loadBookmarks()
  const idx = list.findIndex((x) => x.bookId === bm.bookId && x.chapterId === bm.chapterId)
  if (idx >= 0) list[idx] = bm
  else list.push(bm)
  window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list))
}

export function removeBookmark(bookId: string, chapterId: string) {
  if (typeof window === 'undefined') return
  const list = loadBookmarks()
  const filtered = list.filter((x) => !(x.bookId === bookId && x.chapterId === chapterId))
  window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(filtered))
}

export function isBookmarked(bookId: string, chapterId: string): boolean {
  return loadBookmarks().some((x) => x.bookId === bookId && x.chapterId === chapterId)
}

export function loadCoverOverrides(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  return (
    safeParseJSON<Record<string, string>>(
      window.localStorage.getItem(COVER_OVERRIDES_KEY),
    ) ?? {}
  )
}

export function setCoverOverride(bookId: string, coverPath: string) {
  if (typeof window === 'undefined') return
  const map = loadCoverOverrides()
  map[bookId] = coverPath
  window.localStorage.setItem(COVER_OVERRIDES_KEY, JSON.stringify(map))
}

export function loadNotes(): ReaderNote[] {
  if (typeof window === 'undefined') return []
  return safeParseJSON<ReaderNote[]>(window.localStorage.getItem(NOTES_KEY)) ?? []
}

export function addNote(note: ReaderNote) {
  if (typeof window === 'undefined') return
  const list = loadNotes()
  list.unshift(note)
  window.localStorage.setItem(NOTES_KEY, JSON.stringify(list))
}

export function removeNote(noteId: string) {
  if (typeof window === 'undefined') return
  const filtered = loadNotes().filter((n) => n.id !== noteId)
  window.localStorage.setItem(NOTES_KEY, JSON.stringify(filtered))
}

export function updateNote(noteId: string, patch: Partial<Omit<ReaderNote, 'id' | 'createdAt'>>) {
  if (typeof window === 'undefined') return
  const list = loadNotes()
  const idx = list.findIndex((n) => n.id === noteId)
  if (idx < 0) return
  list[idx] = { ...list[idx], ...patch }
  window.localStorage.setItem(NOTES_KEY, JSON.stringify(list))
}

export function loadLibraryView(): LibraryViewState | undefined {
  if (typeof window === 'undefined') return undefined
  return safeParseJSON<LibraryViewState>(window.localStorage.getItem(LIBRARY_VIEW_KEY))
}

export function saveLibraryView(view: LibraryViewState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LIBRARY_VIEW_KEY, JSON.stringify(view))
}

function dayKey(ts = Date.now()) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function dayKeyForDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function getMinutesThisWeek() {
  const map = new Map(loadSessions().map((s) => [s.day, s.minutes]))
  let total = 0
  const d = new Date()
  for (let i = 0; i < 7; i += 1) {
    total += map.get(dayKeyForDate(d)) ?? 0
    d.setDate(d.getDate() - 1)
  }
  return total
}

export function getLast7DaysMinutes(): Array<{ day: string; minutes: number }> {
  const map = new Map(loadSessions().map((s) => [s.day, s.minutes]))
  const out: Array<{ day: string; minutes: number }> = []
  const d = new Date()
  for (let i = 0; i < 7; i += 1) {
    const key = dayKeyForDate(d)
    out.push({ day: key, minutes: map.get(key) ?? 0 })
    d.setDate(d.getDate() - 1)
  }
  return out
}

export function loadSessions(): ReaderSession[] {
  if (typeof window === 'undefined') return []
  return safeParseJSON<ReaderSession[]>(window.localStorage.getItem(SESSIONS_KEY)) ?? []
}

export function addReadingMinutes(minutes: number, ts = Date.now()) {
  if (typeof window === 'undefined') return
  if (!Number.isFinite(minutes) || minutes <= 0) return
  const key = dayKey(ts)
  const list = loadSessions()
  const idx = list.findIndex((x) => x.day === key)
  if (idx >= 0) list[idx].minutes += minutes
  else list.push({ day: key, minutes })
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(list))
}

export function getTodayReadMinutes() {
  const key = dayKey()
  return loadSessions().find((x) => x.day === key)?.minutes ?? 0
}

export function getReadingStreakDays() {
  const set = new Set(loadSessions().filter((x) => x.minutes > 0).map((x) => x.day))
  let streak = 0
  const d = new Date()
  for (;;) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
    if (!set.has(key)) break
    streak += 1
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export function exportReaderData() {
  return {
    progress: loadProgressMap(),
    prefs: loadPrefs(),
    bookmarks: loadBookmarks(),
    covers: loadCoverOverrides(),
    notes: loadNotes(),
    sessions: loadSessions(),
    exportedAt: Date.now(),
  }
}

export function importReaderData(data: unknown) {
  if (typeof window === 'undefined') return false
  if (!data || typeof data !== 'object') return false
  const d = data as {
    progress?: unknown
    prefs?: unknown
    bookmarks?: unknown
    covers?: unknown
    notes?: unknown
    sessions?: unknown
  }
  if (d.progress) window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(d.progress))
  if (d.prefs) window.localStorage.setItem(PREFS_KEY, JSON.stringify(d.prefs))
  if (d.bookmarks) window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(d.bookmarks))
  if (d.covers) window.localStorage.setItem(COVER_OVERRIDES_KEY, JSON.stringify(d.covers))
  if (d.notes) window.localStorage.setItem(NOTES_KEY, JSON.stringify(d.notes))
  if (d.sessions) window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(d.sessions))
  return true
}

export function loadPinnedBooks(): string[] {
  if (typeof window === 'undefined') return []
  return safeParseJSON<string[]>(window.localStorage.getItem(PINNED_BOOKS_KEY)) ?? []
}

export function togglePinnedBook(bookId: string) {
  if (typeof window === 'undefined') return
  const list = loadPinnedBooks()
  const next = list.includes(bookId)
    ? list.filter((id) => id !== bookId)
    : [...list, bookId]
  window.localStorage.setItem(PINNED_BOOKS_KEY, JSON.stringify(next))
}

