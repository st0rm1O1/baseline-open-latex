import { describe, expect, it } from 'vitest'
import { resolveAssetUrl } from '../src/utils/resolveAssetUrl'
import { pdfFilenameForProject, sanitizeFilename } from '../src/utils/sanitizeFilename'
import { createRequestIdFactory } from '../src/utils/requestId'

describe('resolveAssetUrl', () => {
  it('appends paths to the configured base', () => {
    expect(resolveAssetUrl('busytex/foo.wasm', '/baseline-open-latex/')).toBe(
      '/baseline-open-latex/busytex/foo.wasm',
    )
  })

  it('handles leading slashes and missing trailing slash on base', () => {
    expect(resolveAssetUrl('/assets/x.js', '/baseline-open-latex')).toBe(
      '/baseline-open-latex/assets/x.js',
    )
  })

  it('handles a root base', () => {
    expect(resolveAssetUrl('assets/x.js', '/')).toBe('/assets/x.js')
  })
})

describe('sanitizeFilename', () => {
  it('passes through a plain filename', () => {
    expect(sanitizeFilename('Kunal Resume.pdf')).toBe('Kunal Resume.pdf')
  })

  it('strips path separators and reserved characters', () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij')
  })

  it('trims leading/trailing dots and spaces', () => {
    expect(sanitizeFilename('  .myfile. ')).toBe('myfile')
  })

  it('falls back when nothing remains', () => {
    expect(sanitizeFilename('')).toBe('document.pdf')
    expect(sanitizeFilename('///')).toBe('document.pdf')
  })

  it('uses a custom fallback', () => {
    expect(sanitizeFilename('///', 'document')).toBe('document')
  })
})

describe('pdfFilenameForProject', () => {
  it('derives a pdf filename from the project name', () => {
    expect(pdfFilenameForProject('Kunal Resume')).toBe('Kunal Resume.pdf')
  })

  it('sanitizes unsafe project names', () => {
    expect(pdfFilenameForProject('a/b:c')).toBe('abc.pdf')
  })
})

describe('createRequestIdFactory', () => {
  it('produces unique, monotonic ids', () => {
    const next = createRequestIdFactory('compile')
    const a = next()
    const b = next()
    const c = next()
    expect(a).not.toBe(b)
    expect(b).not.toBe(c)
    expect(a.startsWith('compile-1-')).toBe(true)
    expect(b.startsWith('compile-2-')).toBe(true)
    expect(c.startsWith('compile-3-')).toBe(true)
  })

  it('isolates counters between factories', () => {
    const nextA = createRequestIdFactory('a')
    const nextB = createRequestIdFactory('b')
    expect(nextA()).not.toBe(nextB())
  })
})