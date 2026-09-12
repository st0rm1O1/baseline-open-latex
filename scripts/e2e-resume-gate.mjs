/**
 * End-to-end gate for the on-demand strategy: compile the resume fixture,
 * which needs packages beyond texlive-basic (fontspec, fontawesome5,
 * titlesec, enumitem, fullpage, tex-gyre) plus a vendored font file
 * (Merriweather.otf) for xelatex.
 *
 * Usage: node scripts/e2e-resume-gate.mjs
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
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
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Preview server timed out starting'))
    }, 30_000)
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
      if (stdout.includes('localhost:')) {
        clearTimeout(timeout)
        resolveServer(child)
      }
    })
    child.on('error', reject)
  })
}

async function waitForReady(page, label) {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    const status = await page.evaluate(() => window.__latex?.getStatus?.())
    if (status && !['initializing'].includes(status.state)) return
    await page.waitForTimeout(500)
  }
  throw new Error(`${label}: engine never became ready`)
}

async function main() {
  const server = await startPreviewServer()
  console.log('Server started. Launching browser…')

  const source = readFileSync(resolve(ROOT, 'fixtures', 'resume', 'resume.tex'), 'utf8')
  const fontBase64 = readFileSync(resolve(ROOT, 'fixtures', 'resume', 'Merriweather.otf')).toString('base64')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('pageerror', (error) => console.log(`[pageerror] ${error}`))

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => typeof window.__latex === 'object', undefined, { timeout: 30_000 })
  await waitForReady(page, 'Resume gate')

  console.log('Compiling resume fixture (on-demand packages + vendored font)…')
  const startedAt = Date.now()
  const result = await page.evaluate(async ({ source, fontBase64 }) => {
    const decoded = atob(fontBase64)
    const font = new Uint8Array(decoded.length)
    for (let i = 0; i < decoded.length; i += 1) font[i] = decoded.charCodeAt(i)
    return window.__latex.compileProject({
      id: 'resume',
      name: 'Resume',
      entryFile: 'resume.tex',
      files: [
        { path: 'resume.tex', type: 'text', content: source },
        { path: 'Merriweather.otf', type: 'binary', content: font },
      ],
    })
  }, { source, fontBase64 })
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)

  if (!result || !result.success) {
    console.error(
      'Resume compile failed:',
      result?.errors ?? [],
      result?.warnings?.slice(0, 10) ?? [],
      result?.logs?.[0]?.slice(-1500) ?? '',
    )
    throw new Error(`Resume compile failed after ${elapsed}s`)
  }

  if (!result.pdf || result.pdf.byteLength < 1000) {
    throw new Error(`Resume produced no meaningful PDF (${result.pdf?.byteLength ?? 0} bytes)`)
  }
  console.log(`Resume compiled in ${elapsed}s — PDF ${result.pdf.byteLength} bytes`)

  // PDF rendering must produce ink on canvas.
  await page.locator('.pdf-page').first().waitFor({ state: 'visible', timeout: 60_000 })
  const canvasSize = await page.locator('.pdf-page').first().evaluate((node) => ({
    width: node.width,
    height: node.height,
    hasInk: Array.from(node.getContext('2d').getImageData(0, 0, node.width, node.height).data)
      .filter((byte, index) => index % 4 === 3)
      .some((alphaValue) => alphaValue > 0),
  }))
  if (!canvasSize.hasInk) throw new Error(`Resume canvas has no ink: ${JSON.stringify(canvasSize)}`)
  console.log(`Resume PDF rendered: ${canvasSize.width}x${canvasSize.height} canvas with ink`)

  await page.screenshot({ path: resolve(ROOT, 'dist', 'e2e-resume.png'), fullPage: false })
  await browser.close()
  server.kill('SIGTERM')
  process.exit(0)
}

main().catch((error) => {
  console.error('E2E resume gate failed:', error)
  process.exit(1)
})