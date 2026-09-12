import { IndexedDbProjectRepository } from './indexedDbRepository'
import { MemoryProjectRepository } from './memoryRepository'
import type { ProjectRepository } from './types'

/**
 * Creates the production repository, degrading to in-memory storage (with a
 * warning) when IndexedDB is unavailable, e.g. in private browsing modes.
 */
export function createProjectRepository(): ProjectRepository {
  try {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not available in this context')
    }
    return new IndexedDbProjectRepository()
  } catch (error) {
    console.warn('[projects] IndexedDB unavailable; changes will not persist.', error)
    return new MemoryProjectRepository()
  }
}