// Copy the plugin's runtime files into the dsh profile that loads it.
//
// The profile installs this package as a `file:` dependency, so pnpm copies the
// package (honouring `files` in package.json) into
// <profile>/node_modules/@local/bearing-notes. The running app reads that copy,
// not the workspace, so re-run this after editing the plugin and then restart
// DeepSeek Harness (a Host-half change is not picked up live).
//
// Usage: node sync-install.mjs <profileDir>
//        node sync-install.mjs      (falls back to $DSH_PROFILE_DIR, set inside a dsh session)
import { copyFileSync, mkdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const profile = process.argv[2] ?? process.env.DSH_PROFILE_DIR
if (!profile) {
  console.error('usage: node sync-install.mjs <profileDir>   (or set DSH_PROFILE_DIR)')
  process.exit(2)
}
const target = join(profile, 'node_modules', '@local', 'bearing-notes')

/** The runtime file set: `files` in package.json plus the manifest and README. */
const FILES = [
  'package.json',
  'index.js',
  'cordis.patch.yml',
  'icon.svg',
  'README.md',
  'lib/client.js',
  'lib/docx.mjs',
  'lib/store.mjs',
  'lib/domain.mjs',
  'lib/glossary.mjs',
  'lib/translate.mjs',
  'locale/zh.json',
  'locale/en.json',
]

if (!existsSync(profile)) {
  console.error(`profile not found: ${profile}`)
  process.exit(1)
}
if (!existsSync(target)) {
  console.error(`plugin is not installed in ${profile}; install the bundle first`)
  process.exit(1)
}

const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 12)
let changed = 0
for (const rel of FILES) {
  const from = join(here, rel)
  const to = join(target, rel)
  if (!existsSync(from)) { console.log(`MISSING  ${rel}`); continue }
  const before = existsSync(to) ? sha(to) : '-'
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  const after = sha(to)
  const same = before === after
  if (!same) changed++
  console.log(`${same ? 'SAME' : before === '-' ? 'ADD ' : 'DIFF'}  ${rel}`)
}
console.log(`\nsynced ${FILES.length} files into ${target} (${changed} updated)`)
console.log(`workspace mtime ${statSync(join(here, 'index.js')).mtime.toISOString()}`)
