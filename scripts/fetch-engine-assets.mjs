/**
 * Downloads the TeXlyre-BusyTeX asset archive and copies only the files the
 * app needs into public/busytex/.
 *
 * The upstream release ships a single ~500MB archive containing every TeX Live
 * data tier (basic/recommended/extra). Packages are only granular at tier
 * level, so this script keeps just:
 *
 *   - the combined engine (busytex.js/.wasm) and its worker/pipeline glue
 *     (busytex_worker.js imports busytex_biber.js and busytex_pipeline.js)
 *   - the texlive-basic data tier (covers hyperref, fancyhdr, tabularx,
 *     amsmath, xcolor, geometry, latex-fonts, ...)
 *
 * Everything beyond texlive-basic (fontspec, fontawesome5, titlesec, ...) is
 * fetched once at compile time from the public TeX Live endpoint
 * (https://texlive2026.texlyre.org) and cached by the engine in IndexedDB.
 * See src/compiler/busytex/engineConfig.ts.
 *
 * Usage: node scripts/fetch-engine-assets.mjs
 * Env:   TEXLYRE_ASSETS_VERSION  (defaults to v1.4.0)
 *        TEXLYRE_ASSETS_ARCHIVE  path to an already-downloaded archive to
 *                                avoid re-downloading ~500MB.
 */
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { mkdtempSync, readdirSync, statSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO = 'TeXlyre/texlyre-busytex'
const VERSION = process.env.TEXLYRE_ASSETS_VERSION ?? 'v1.4.0'
const ARCHIVE_NAME = 'busytex-assets.tar.gz'
const DOWNLOAD_URL = `https://github.com/${REPO}/releases/download/assets-${VERSION}/${ARCHIVE_NAME}`

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = resolve(REPO_ROOT, 'public', 'busytex')

/** Files from the archive root that make up our curated bundle. */
const KEEP = [
  'busytex.js',
  'busytex.wasm',
  'busytex_worker.js',
  'busytex_biber.js',
  'busytex_pipeline.js',
  'texlive-basic.js',
  'texlive-basic.data',
  'texmf.cnf',
  'versions.txt',
]

const human = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

/** Follow redirects and stream to disk. */
function download(url, dest) {
  console.log(`Downloading ${url}`)
  return new Promise((resolveP, reject) => {
    const requestP = new URL(url)
    const https = requestP.protocol === 'https:' ? import('node:https') : import('node:http')
    ;(async () => {
      const mod = await https
      mod.default.get(requestP, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume()
          return resolveP(download(new URL(response.headers.location, url).toString(), dest))
        }
        if (response.statusCode !== 200) {
          response.resume()
          return reject(new Error(`HTTP ${response.statusCode} for ${url}`))
        }
        const file = createWriteStream(dest)
        response.pipe(file)
        file.on('finish', () => file.close(() => resolveP()))
        file.on('error', reject)
      }).on('error', reject)
    })()
  })
}

function extract(archivePath, workDir) {
  console.log('Extracting archive...')
  try {
    execFileSync('tar', ['-xzf', archivePath, '-C', workDir], { stdio: 'inherit' })
  } catch {
    execFileSync('tar', ['-xzf', archivePath, '-C', workDir])
  }
}

function main() {
  if (existsSync(join(OUT_DIR, 'busytex.js')) && existsSync(join(OUT_DIR, 'texlive-basic.data'))) {
    console.log('✓ BusyTeX assets already present in public/busytex')
    return
  }

  const cachedArchive = process.env.TEXLYRE_ASSETS_ARCHIVE
  const workDir = mkdtempSync(join(tmpdir(), 'busytex-fetch-'))
  const archivePath = join(workDir, ARCHIVE_NAME)
  const srcDir = join(workDir, 'busytex')

  try {
    mkdirSync(OUT_DIR, { recursive: true })
    if (cachedArchive && existsSync(cachedArchive)) {
      console.log(`Using cached archive at ${cachedArchive}`)
      copyFileSync(cachedArchive, archivePath)
    } else {
      download(DOWNLOAD_URL, archivePath)
    }
    extract(archivePath, workDir)

    if (!existsSync(srcDir)) {
      throw new Error(`Expected extracted assets under ${srcDir}`)
    }

    const copied = []
    for (const name of KEEP) {
      const source = join(srcDir, name)
      if (!existsSync(source)) {
        console.warn(`! Skipping ${name}: not present in archive`)
        continue
      }
      copyFileSync(source, join(OUT_DIR, name))
      copied.push(`${name}\t${human(statSync(join(OUT_DIR, name)).size)}`)
    }

    console.log(`\n✓ Copied ${copied.length} files into public/busytex`)
    console.log(copied.join('\n'))
    console.log(`\nTotal: ${human(readdirSync(OUT_DIR).reduce((sum, name) => sum + statSync(join(OUT_DIR, name)).size, 0))}`)
    console.log('\nExcluded tiers: texlive-recommended, texlive-extra, biber, texmfrepo.txt')
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

main()