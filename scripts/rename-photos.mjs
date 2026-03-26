import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const PHOTOS_DIR = path.join(ROOT, 'public', 'photos')

if (!fs.existsSync(PHOTOS_DIR)) {
  console.error(`[rename-photos] Missing directory: ${PHOTOS_DIR}`)
  process.exit(1)
}

const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const entries = fs
  .readdirSync(PHOTOS_DIR, { withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => e.name)
  .filter((name) => exts.has(path.extname(name).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

if (!entries.length) {
  console.log('[rename-photos] No images found.')
  process.exit(0)
}

// Two-phase rename to avoid collisions: original -> __tmp__N.ext, then -> N.ext
const tmpNames = []
for (let i = 0; i < entries.length; i += 1) {
  const from = path.join(PHOTOS_DIR, entries[i])
  const ext = path.extname(entries[i]).toLowerCase()
  const tmp = `__tmp__${i + 1}${ext}`
  const to = path.join(PHOTOS_DIR, tmp)
  fs.renameSync(from, to)
  tmpNames.push(tmp)
}

for (let i = 0; i < tmpNames.length; i += 1) {
  const ext = path.extname(tmpNames[i]).toLowerCase()
  const from = path.join(PHOTOS_DIR, tmpNames[i])
  const to = path.join(PHOTOS_DIR, `${i + 1}${ext}`)
  fs.renameSync(from, to)
}

console.log(`[rename-photos] Renamed ${entries.length} files to 1..${entries.length}`)

