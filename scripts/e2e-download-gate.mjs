/**
 * End-to-end gate: start the production build, open a real browser, compile
 * the default document, and confirm the Download PDF button saves a
 * non-empty file (regression: object URLs revoked too early yielded 0-byte
 * downloads).
 *
 * Usage: node scripts/e2e-download-gate.mjs
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASE_URL = 'http://localhost:4173/baseline-open-latex/'

function startPreviewServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(
      process.execPath,
      [resolve(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', '4173'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let ready = false
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Preview server timed out starting'))
    }, 30_000)
    child.stdout.on('data', (chunk) => {
      if (ready) return
      stdout += String(chunk)
      process.stdout.write(chunk)
      if (stdout.includes('Local:') || stdout.includes('localhost:')) {
        ready = true
        clearTimeout(timeout)
        resolveServer(child)
      }
    })
    child.on('error', reject)
  })
}

async function main() {
  console.log('Starting preview server…')
  const server = await startPreviewServer()
  console.log('Server started. Launching browser…')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ acceptDownloads: true })

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser:${msg.type()}] ${msg.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    console.log(`[pageerror] ${error}`)
  })

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })

  const compileButton = page.locator('button:has-text("Compile")')

  await compileButton.waitFor({ state: 'visible', timeout: 60_000 })
  const deadline = Date.now() + 180_000
  while (await compileButton.isDisabled()) {
    if (Date.now() > deadline) throw new Error('Compile button never became enabled')
    await page.waitForTimeout(500)
  }

  console.log('Compile button enabled — clicking…')
  await compileButton.click()

  const finishDeadline = Date.now() + 180_000
  let statusText = ''
  while (Date.now() < finishDeadline) {
    await page.waitForTimeout(1000)
    statusText = await page.locator('.statusbar__text').textContent()
    if (/Compiled in|failed|error/i.test(statusText)) break
  }
  statusText = await page.locator('.statusbar__text').textContent()
  console.log(`Status: ${statusText}`)

  if (!statusText.startsWith('Compiled in')) {
    throw new Error(`Compile did not finish successfully; status: "${statusText}"`)
  }

  const downloadButton = page.locator('button:has-text("Download PDF")')
  if (await downloadButton.isDisabled()) {
    throw new Error('Download PDF button never became enabled')
  }

  console.log('Clicking Download PDF…')
  const downloadPromise = page.waitForEvent('download')
  await downloadButton.click()
  const download = await downloadPromise

  const failure = await download.failure()
  if (failure) {
    throw new Error(`Download failed: ${failure}`)
  }
  console.log(`Saved as "${download.suggestedFilename()}"`)

  const downloadPath = await download.path()
  const { stat } = await import('node:fs/promises')
  const info = await stat(downloadPath)
  if (info.size <= 0) {
    throw new Error(`Downloaded PDF is empty (${info.size} bytes)`)
  }
  console.log(`Downloaded PDF has ${info.size} bytes ✓`)

  await browser.close()
  server.kill('SIGTERM')
  process.exit(0)
}

main().catch((error) => {
  console.error('E2E gate failed:', error)
  process.exit(1)
})