// Reusable client logo maintenance workflow.
//
// Scans logo-dump/ for image files, infers a clean slug filename from each
// name, and copies it into public/client-logos/. Originals are never deleted.
//
// Run with:  node scripts/sync-client-logos.mjs
//
// See CLIENT_LOGO_MAINTENANCE.md for the full workflow.

import { readdirSync, copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { dirname, extname, join, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'logo-dump')
const DEST_DIR = join(ROOT, 'public', 'client-logos')

const SUPPORTED = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg'])

// Common filler words stripped from logo filenames (not from client names).
const STOP_WORDS = new Set([
  'logo', 'final', 'copy', 'white', 'black', 'transparent',
  'icon', '01', '02', 'new', 'old',
])

function slugifyBase(base) {
  const spaced = base.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  const raw = spaced
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const tokens = raw.split('-').filter(Boolean)
  let removedStop = 0
  let kept = tokens.filter(token => {
    if (STOP_WORDS.has(token)) {
      removedStop += 1
      return false
    }
    return true
  })

  // Drop trailing standalone single-character tokens (e.g. "0", "o") which are
  // almost always export artifacts rather than part of the brand name.
  let removedTrailingSingle = false
  while (kept.length > 1 && kept[kept.length - 1].length === 1) {
    kept.pop()
    removedTrailingSingle = true
  }

  // If everything was stripped, fall back to the raw slug so we never produce
  // an empty filename.
  const slug = kept.join('-') || raw

  // A slug needs human review when the source name was messy enough that the
  // brand is ambiguous: multiple filler words removed, an artifact stripped,
  // or nothing meaningful left.
  const needsReview = removedStop >= 2 || removedTrailingSingle || kept.length === 0

  return { slug, needsReview, removedStop, removedTrailingSingle }
}

function run() {
  if (!existsSync(SRC_DIR)) {
    console.error(`Source folder not found: ${SRC_DIR}`)
    process.exit(1)
  }
  mkdirSync(DEST_DIR, { recursive: true })

  const copied = []
  const skipped = []
  const needsReview = []
  const seenSlugs = new Map()

  const entries = readdirSync(SRC_DIR)
    .filter(name => statSync(join(SRC_DIR, name)).isFile())
    .sort((a, b) => a.localeCompare(b))

  for (const name of entries) {
    const ext = extname(name).toLowerCase()
    if (!SUPPORTED.has(ext)) {
      skipped.push({ name, reason: `unsupported extension (${ext || 'none'})` })
      continue
    }

    const { slug, needsReview: review } = slugifyBase(basename(name, extname(name)))
    if (!slug) {
      skipped.push({ name, reason: 'could not infer a slug' })
      continue
    }

    const targetName = `${slug}${ext}`
    const targetPath = join(DEST_DIR, targetName)

    if (seenSlugs.has(slug) && seenSlugs.get(slug) !== name) {
      needsReview.push({ name, target: targetName, note: `slug collides with ${seenSlugs.get(slug)}` })
    }
    seenSlugs.set(slug, name)

    copyFileSync(join(SRC_DIR, name), targetPath)
    copied.push({ name, target: targetName })
    if (review) {
      needsReview.push({ name, target: targetName, note: 'slug inferred from a messy filename — verify the client name' })
    }
  }

  console.log('\nClient logo sync')
  console.log('================')
  console.log(`Source : ${SRC_DIR}`)
  console.log(`Output : ${DEST_DIR}`)

  console.log(`\nCopied (${copied.length}):`)
  copied.forEach(item => console.log(`  ${item.name}  ->  ${item.target}`))

  console.log(`\nSkipped (${skipped.length}):`)
  if (skipped.length === 0) console.log('  (none)')
  skipped.forEach(item => console.log(`  ${item.name}  —  ${item.reason}`))

  console.log(`\nNeeds review (${needsReview.length}):`)
  if (needsReview.length === 0) console.log('  (none)')
  needsReview.forEach(item => console.log(`  ${item.name}  ->  ${item.target}  —  ${item.note}`))
  console.log('')
}

run()
