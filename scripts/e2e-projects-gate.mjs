/**
 * End-to-end gate: start the production build, open a real browser with an
 * empty profile, and exercise project deletion end to end — confirm flow,
 * fallback selection, no resurrection after reload, and the empty state when
 * the last project goes.
 *
 * Usage: node scripts/e2e-projects-gate.mjs
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

async function waitForValue(page, predicate, label, timeoutMs = 30_000) {
  const select = page.locator('select.topbar__project-select')
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await select.inputValue().catch(() => '')
    if (predicate(value)) return value
    await page.waitForTimeout(250)
  }
  const value = await select.inputValue().catch(() => 'ERR')
  throw new Error(`Project select did not settle on ${label} (got "${value}")`)
}

async function waitForOptionCount(page, expected, timeoutMs = 30_000) {
  const select = page.locator('select.topbar__project-select')
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const count = await select.locator('option').count().catch(() => 0)
    if (count === expected) return
    await page.waitForTimeout(250)
  }
  const count = await select.locator('option').count().catch(() => -1)
  throw new Error(`Project select did not reach ${expected} options (got ${count})`)
}

async function clickDeleteAndAccept(page) {
  page.once('dialog', (dialog) => void dialog.accept())
  await page.locator('button:has-text("Delete")').click()
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
  await waitForValue(page, (value) => value.startsWith('sample-'), 'a seeded sample')
  await waitForOptionCount(page, 3)
  console.log('Fresh profile seeded with 3 samples')

  // Create a new project; it becomes active, leaving 4 options.
  await page.locator('button:has-text("New")').click()
  const doomedId = await waitForValue(
    page,
    (value) => value.startsWith('project-'),
    'the new project',
  )
  await waitForOptionCount(page, 4)
  console.log(`New project created and active: ${doomedId}`)

  // A dismissed confirm must abort the deletion entirely.
  page.once('dialog', (dialog) => void dialog.dismiss())
  await page.locator('button:has-text("Delete")').click()
  await page.waitForTimeout(500)
  if ((await page.locator('select.topbar__project-select').inputValue()) !== doomedId) {
    throw new Error('Project changed even though the delete confirm was dismissed')
  }
  if ((await page.locator('select.topbar__project-select option').count()) !== 4) {
    throw new Error('Option count changed even though the delete confirm was dismissed')
  }
  console.log('Dismissed confirm leaves the project untouched')

  // Accepted delete: the active project is removed and a fallback takes over.
  await clickDeleteAndAccept(page)
  await waitForValue(page, (value) => value !== doomedId, 'a fallback project')
  await waitForOptionCount(page, 3)
  console.log('Deleted active project; fell back to a remaining project')

  // Let autosave settle, then reload: the deleted project must not resurrect.
  await page.waitForTimeout(1200)
  await page.reload({ waitUntil: 'networkidle' })
  await waitForLatexSeam(page)
  await waitForOptionCount(page, 3)
  const restored = await page.locator('select.topbar__project-select').inputValue()
  if (restored === doomedId) {
    throw new Error('Deleted project resurrected after reload')
  }
  console.log('Deleted project did not come back after reload')

  // Delete every remaining project: UI must collapse to a clean empty state.
  while (true) {
    const count = await page.locator('select.topbar__project-select option').count().catch(() => 0)
    if (count === 0) break
    await clickDeleteAndAccept(page)
    await page.waitForTimeout(400)
  }
  const selectGone = (await page.locator('select.topbar__project-select').count()) === 0
  if (!selectGone) {
    throw new Error('Project select still present after deleting every project')
  }
  const compileDisabled = await page.locator('button:has-text("Compile")').isDisabled()
  const deleteDisabled = await page.locator('button:has-text("Delete")').isDisabled()
  if (!compileDisabled || !deleteDisabled) {
    throw new Error(
      `Compile/Delete not disabled in the empty state (compile=${compileDisabled}, delete=${deleteDisabled})`,
    )
  }
  console.log('Empty state: no projects, Compile/Delete disabled')

  // New still recovers from the empty state.
  await page.locator('button:has-text("New")').click()
  await waitForValue(page, (value) => value.startsWith('project-'), 'a fresh project')
  await waitForOptionCount(page, 1)
  console.log('New restores a single project from the empty state')

  await page.screenshot({ path: resolve(ROOT, 'dist', 'e2e-projects.png'), fullPage: false })
  console.log('Screenshot saved to dist/e2e-projects.png')

  await context.close()
  await browser.close()
  server.kill('SIGTERM')
  process.exit(0)
}

main().catch((error) => {
  console.error('E2E gate failed:', error)
  process.exit(1)
})