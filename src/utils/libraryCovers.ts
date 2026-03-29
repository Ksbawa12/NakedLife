/** Static cover art paths (see `public/covers/`). */
export const LIBRARY_CARD_COVER_PATHS = [
  '/covers/IMG_0070.JPG',
  '/covers/IMG_0071.JPG',
  '/covers/IMG_0072.JPG',
  '/covers/IMG_0073.JPG',
  '/covers/IMG_0074.JPG',
  '/covers/IMG_0075.JPG',
  '/covers/IMG_0076.JPG',
  '/covers/IMG_0077.JPG',
  '/covers/IMG_0078.JPG',
  '/covers/IMG_0079.JPG',
  '/covers/IMG_0080.JPG',
  '/covers/IMG_0081.JPG',
]

export const DEFAULT_LIBRARY_BOOK_COVER = '/books/naked-family-cover.png'

function hashStringToUint32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Fisher–Yates shuffle with deterministic PRNG (stable across reloads for the same inputs). */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr]
  let state = seed >>> 0 || 1
  const nextUnit = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextUnit() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function buildImagePool(staticCovers: string[], photoSrcs: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of [...staticCovers, ...photoSrcs]) {
    const t = p?.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/**
 * One distinct image per book (no repeats) while `pool.length >= bookIds.length`;
 * if there are more books than images, wraps with modulo.
 */
export function assignUniqueCovers(
  bookIds: string[],
  pool: string[],
  seed: number,
  fallback: string,
): Record<string, string> {
  const sortedIds = [...bookIds].sort()
  if (!sortedIds.length) return {}
  if (!pool.length) {
    return Object.fromEntries(sortedIds.map((id) => [id, fallback]))
  }
  const shuffled = seededShuffle(pool, seed)
  const map: Record<string, string> = {}
  for (let i = 0; i < sortedIds.length; i += 1) {
    map[sortedIds[i]] = shuffled[i % shuffled.length] ?? fallback
  }
  return map
}

export function libraryCoverSeed(bookIds: string[]): number {
  return hashStringToUint32([...bookIds].sort().join('\0'))
}
