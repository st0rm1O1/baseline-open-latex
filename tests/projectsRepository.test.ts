import { describe, it, expect, vi, beforeEach } from 'vitest'

import 'fake-indexeddb/auto'

import { MemoryProjectRepository } from '../src/projects/memoryRepository'
import { IndexedDbProjectRepository } from '../src/projects/indexedDbRepository'
import { createProjectRepository } from '../src/projects/projectRepositoryFactory'
import type { ProjectDocument } from '../src/projects/types'

function makeProject(id: string, updatedAt: number): ProjectDocument {
  return {
    id,
    name: `Project ${id}`,
    entryFile: 'main.tex',
    source: `\\documentclass{article}\n% ${id}\n`,
    updatedAt,
  }
}

// ------------------------------------------------------------------ Memory

describe('MemoryProjectRepository', () => {
  it('returns an empty list for a fresh instance', async () => {
    const repo = new MemoryProjectRepository()
    expect(await repo.list()).toEqual([])
  })

  it('saves, gets and lists in updatedAt descending order', async () => {
    const repo = new MemoryProjectRepository()
    await repo.save(makeProject('a', 100))
    await repo.save(makeProject('b', 300))
    await repo.save(makeProject('c', 200))

    const list = await repo.list()
    expect(list.map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('overwrites in place when saving the same id', async () => {
    const repo = new MemoryProjectRepository()
    await repo.save(makeProject('x', 1))
    await repo.save({ ...makeProject('x', 2), name: 'Updated' })

    const doc = await repo.get('x')
    expect(doc?.name).toBe('Updated')
    expect(doc?.updatedAt).toBe(2)
    expect((await repo.list()).length).toBe(1)
  })

  it('returns null for a missing id', async () => {
    const repo = new MemoryProjectRepository()
    expect(await repo.get('nonexistent')).toBeNull()
  })

  it('deletes a document', async () => {
    const repo = new MemoryProjectRepository()
    await repo.save(makeProject('del', 1))
    await repo.delete('del')
    expect(await repo.get('del')).toBeNull()
  })
})

// --------------------------------------------------------------------- IDB

describe('IndexedDbProjectRepository', () => {
  let dbName: string

  // Each test gets an isolated database so tests never interfere with each
  // other, avoiding the delete/open races of shared-name cleanup.
  beforeEach(() => {
    dbName = `test-projects-${Math.random().toString(36).slice(2)}`
  })

  it('round-trips through IDB with the same instance', async () => {
    const repo = new IndexedDbProjectRepository(dbName)
    const project = makeProject('persist-1', Date.now())
    await repo.save(project)
    expect(await repo.get('persist-1')).toEqual(project)
  })

  it('round-trips across two separate instances (cross-process persistence)', async () => {
    const repo1 = new IndexedDbProjectRepository(dbName)
    const project = makeProject('cross', Date.now())
    await repo1.save(project)

    const repo2 = new IndexedDbProjectRepository(dbName)
    expect(await repo2.get('cross')).toEqual(project)
    expect((await repo2.list()).length).toBe(1)
  })

  it('returns documents in updatedAt descending order', async () => {
    const repo = new IndexedDbProjectRepository(dbName)
    await repo.save(makeProject('z', 10))
    await repo.save(makeProject('m', 50))
    await repo.save(makeProject('a', 30))

    const ids = (await repo.list()).map((p) => p.id)
    expect(ids).toEqual(['m', 'a', 'z'])
  })

  it('returns null for a missing id', async () => {
    const repo = new IndexedDbProjectRepository(dbName)
    expect(await repo.get('nonexistent')).toBeNull()
  })

  it('overwrites in place on the same key', async () => {
    const repo = new IndexedDbProjectRepository(dbName)
    await repo.save(makeProject('dup', 1))
    await repo.save({ ...makeProject('dup', 2), name: 'V2' })

    const doc = await repo.get('dup')
    expect(doc?.name).toBe('V2')
    expect((await repo.list()).length).toBe(1)
  })

  it('deletes from the store', async () => {
    const repo = new IndexedDbProjectRepository(dbName)
    await repo.save(makeProject('del', 1))
    await repo.delete('del')
    expect(await repo.get('del')).toBeNull()
  })
})

// --------------------------------------------------------------- Factory

describe('createProjectRepository', () => {
  it('falls back to MemoryProjectRepository when indexedDB is unavailable', () => {
    // Temporarily hide the fake-indexeddb global to simulate an environment
    // without IndexedDB (e.g. private browsing). The factory must degrade.
    const originalIndexedDb = globalThis.indexedDB
    Reflect.deleteProperty(globalThis, 'indexedDB')
    try {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const repo = createProjectRepository()
      expect(repo).toBeInstanceOf(MemoryProjectRepository)
      expect(warnSpy).toHaveBeenCalledTimes(1)
      warnSpy.mockRestore()
    } finally {
      ;(globalThis as { indexedDB?: IDBFactory }).indexedDB = originalIndexedDb
    }
  })
})