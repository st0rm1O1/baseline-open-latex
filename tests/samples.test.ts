import { describe, it, expect } from 'vitest'
import { createNewDocument, SAMPLE_PROJECTS } from '../src/projects/samples'

describe('SAMPLE_PROJECTS', () => {
  it('contains the default basic project referencing the Hello World document', () => {
    const basic = SAMPLE_PROJECTS.find((p) => p.id === 'sample-basic')
    expect(basic).toBeDefined()
    expect(basic?.entryFile).toBe('main.tex')
    expect(basic?.source).toContain('Hello World.')
  })
})

describe('createNewDocument', () => {
  it('creates a fresh document with the expected defaults', () => {
    const doc = createNewDocument('test-id')
    expect(doc.id).toBe('test-id')
    expect(doc.name).toBe('Untitled Project')
    expect(doc.entryFile).toBe('main.tex')
    expect(doc.source).toContain('Hello World.')
    expect(doc.updatedAt).toBeGreaterThan(0)
  })

  it('returns distinct ids on successive calls', () => {
    const a = createNewDocument('id-a')
    const b = createNewDocument('id-b')
    expect(a.id).not.toBe(b.id)
  })
})