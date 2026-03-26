import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const PUBLIC_DIR = path.join(ROOT, 'public')
const PHOTOS_DIR = path.join(PUBLIC_DIR, 'photos')
const OUT_FILE = path.join(PUBLIC_DIR, 'photos.json')

function listFilesRec(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listFilesRec(full))
    else out.push(full)
  }
  return out
}

const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const all = listFilesRec(PHOTOS_DIR)
  .filter((f) => exts.has(path.extname(f).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

const items = all.map((abs) => {
  const relFromPublic = path.relative(PUBLIC_DIR, abs).split(path.sep).join('/')
  return {
    src: `/${relFromPublic}`,
    name: path.basename(relFromPublic),
    order: (() => {
      const base = path.basename(relFromPublic, path.extname(relFromPublic))
      const n = Number(base)
      return Number.isFinite(n) ? n : null
    })(),
  }
})

const payload = {
  generatedAt: Date.now(),
  count: items.length,
  items,
}

fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8')
console.log(`[generate-photos] Wrote ${items.length} photos → public/photos.json`)
