const MARK_CLASS = 'reader-chapter-search'
const ACTIVE_CLASS = 'reader-chapter-search--active'

function unwrapMarks(root: HTMLElement) {
  root.querySelectorAll(`mark.${MARK_CLASS}`).forEach((m) => {
    const parent = m.parentNode
    if (!parent) return
    while (m.firstChild) parent.insertBefore(m.firstChild, m)
    parent.removeChild(m)
  })
}

function highlightAllInTextNode(start: Text, query: string, marks: HTMLElement[]) {
  const lower = query.toLowerCase()
  let current: Text | null = start
  while (current) {
    const text: string = current.nodeValue ?? ''
    const idx = text.toLowerCase().indexOf(lower)
    if (idx === -1) break
    const parent = current.parentNode
    if (!parent) break
    const before = text.slice(0, idx)
    const match = text.slice(idx, idx + query.length)
    const after: string = text.slice(idx + query.length)
    const mark = document.createElement('mark')
    mark.className = MARK_CLASS
    mark.appendChild(document.createTextNode(match))
    const tail = document.createTextNode(after)
    current.textContent = before
    parent.insertBefore(mark, current.nextSibling)
    parent.insertBefore(tail, mark.nextSibling)
    marks.push(mark)
    current = after.length ? tail : null
  }
}

/**
 * Wrap matches in <mark> inside root. Returns mark elements in document order.
 */
export function applyChapterSearch(root: HTMLElement | null, query: string): HTMLElement[] {
  if (!root) return []
  unwrapMarks(root)
  const q = query.trim()
  if (q.length < 2) return []

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) {
    const tn = n as Text
    let el: HTMLElement | null = tn.parentElement
    let skip = false
    while (el) {
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') {
        skip = true
        break
      }
      el = el.parentElement
    }
    if (!skip && (tn.nodeValue?.length ?? 0) > 0) textNodes.push(tn)
  }

  const marks: HTMLElement[] = []
  for (const tn of textNodes) {
    if (!tn.parentNode) continue
    highlightAllInTextNode(tn, q, marks)
  }
  return marks
}

export function setActiveSearchMark(marks: HTMLElement[], index: number) {
  marks.forEach((m, i) => {
    if (i === index) m.classList.add(ACTIVE_CLASS)
    else m.classList.remove(ACTIVE_CLASS)
  })
  const active = marks[index]
  if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

export function clearChapterSearch(root: HTMLElement | null) {
  if (!root) return
  unwrapMarks(root)
}
