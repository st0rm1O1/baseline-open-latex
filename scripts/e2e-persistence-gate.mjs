/**
 * End-to-end gate: start the production build, open a real browser with an
 * empty profile, edit the seeded document through the test seam, and confirm
 * the change survives a full reload (IndexedDB autosave round-trip).
 *
 * Usage: node scripts/e2e-persistence-gate.mjs
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

async function waitForLatexSeam(page, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const present = await page.evaluate(() => Boolean(window.__latex))
    if (present) return
    await page.waitForTimeout(250)
  }
  throw new Error('window.__latex test seam never appeared')
}

async function waitForSelect(page, expectedValue, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  const select = page.locator('select.topbar__project-select')
  while (Date.now() < deadline) {
    const value = await select.inputValue().catch(() => '')
    if (value === expectedValue) return
    await page.waitForTimeout(250)
  }
  const value = await select.inputValue().catch(() => 'ERR')
  throw new Error(`Project select did not settle on "${expectedValue}" (got "${value}")`)
}

async function main() {
  console.log('Starting preview server…')
  const server = await startPreviewServer()
  console.log('Server started. Launching browser with a fresh profile…')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser:${msg.type()}] ${msg.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    console.log(`[pageerror] ${error}`)
  })

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await waitForLatexSeam(page)

  // First run: samples must be seeded and the first sample restored.
  await waitForSelect(page, 'sample-basic')
  const seededSource = await page.evaluate(() => window.__latex.getSource())
  if (!seededSource.includes('Hello World.')) {
    throw new Error(`Seeded source missing expected content: "${seededSource.slice(0, 80)}"`)
  }
  console.log('Seeded sample restored (sample-basic / Hello World document)')

  // Edit through the seam (same path as typing), then outlive debounce+save.
  const marker = `% e2e-persistence-marker-${Date.now()}`
  await page.evaluate((text) => window.__latex.setSource(text), marker)
  await page.waitForTimeout(2000)

  // Force a full reload and confirm the edited source comes back from IDB.
  await page.reload({ waitUntil: 'networkidle' })
  await waitForLatexSeam(page)
  await waitForSelect(page, 'sample-basic')
  const restoredSource = await page.evaluate(() => window.__latex.getSource())
  if (restoredSource !== marker) {
    throw new Error(
      `Autosaved source not restored after reload; expected "${marker}", got "${restoredSource.slice(0, 80)}"`,
    )
  }
  console.log('Autosaved source survived reload (IndexedDB round-trip OK)')

  await page.screenshot({ path: resolve(ROOT, 'dist', 'e2e-persistence.png'), fullPage: false })
  console.log('Screenshot saved to dist/e2e-persistence.png')

  await context.close()
  await browser.close()
  server.kill('SIGTERM')
  process.exit(0)
}

main().catch((error) => {
  console.error('E2E gate failed:', error)
  process.exit(1)
})