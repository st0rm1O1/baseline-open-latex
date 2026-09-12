/**
 * End-to-end gate: start the production build, open a real browser, compile
 * the default document, and confirm a PDF comes back.
 *
 * Usage: node scripts/e2e-compile-gate.mjs
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
  const page = await browser.newPage()

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

  // Wait for the engine to initialize (Compile enabled + button visible).
  await compileButton.waitFor({ state: 'visible', timeout: 60_000 })
  const deadline = Date.now() + 180_000
  while (await compileButton.isDisabled()) {
    if (Date.now() > deadline) throw new Error('Compile button never became enabled')
    await page.waitForTimeout(500)
  }

  console.log('Compile button enabled — clicking…')
  await compileButton.click()

  // Wait for a finished compile (success) or a failure state.
  const finishDeadline = Date.now() + 180_000
  let statusText = ''
  while (Date.now() < finishDeadline) {
    await page.waitForTimeout(1000)
    statusText = await page.locator('.statusbar__text').textContent()
    if (/Compiled in|Compilation failed|Compilation cancelled|Compilation|error/i.test(statusText)) {
      const state = statusText.toLowerCase()
      if (state.startsWith('compiled')) break
      if (/failed|error/.test(state)) break
    }
  }
  statusText = await page.locator('.statusbar__text').textContent()
  console.log(`Status: ${statusText}`)

  if (!statusText.startsWith('Compiled in')) {
    const errorBox = page.locator('.pdf-error, .error-state')
    if (await errorBox.count()) {
      console.log('Error box:', await errorBox.textContent())
    }
    throw new Error(`Compile did not finish successfully; status: "${statusText}"`)
  }

  // The compiled PDF must actually render: at least one page canvas with ink.
  await page.locator('.pdf-page').first().waitFor({ state: 'visible', timeout: 60_000 })
  const canvasSize = await page.locator('.pdf-page').first().evaluate((node) => ({
    width: node.width,
    height: node.height,
    hasInk: Array.from(node.getContext('2d').getImageData(0, 0, node.width, node.height).data)
      .filter((byte, index) => index % 4 === 3)
      .some((alphaValue) => alphaValue > 0),
  }))
  if (canvasSize.width === 0 || canvasSize.height === 0 || !canvasSize.hasInk) {
    throw new Error(`PDF canvas did not render: ${JSON.stringify(canvasSize)}`)
  }
  console.log(`PDF rendered: ${canvasSize.width}x${canvasSize.height} canvas with ink`)

  await page.screenshot({ path: resolve(ROOT, 'dist', 'e2e-compiled.png'), fullPage: false })
  console.log('Screenshot saved to dist/e2e-compiled.png')

  await browser.close()
  server.kill('SIGTERM')
  process.exit(0)
}

main().catch((error) => {
  console.error('E2E gate failed:', error)
  process.exit(1)
})