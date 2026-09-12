import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { ProjectDocument, ProjectRepository } from './types'

interface ProjectDb extends DBSchema {
  projects: {
    key: string
    value: ProjectDocument
    indexes: { 'by-updated': number }
  }
}

const DB_NAME = 'baseline-open-latex'
const DB_VERSION = 1

/**
 * IndexedDB-backed repository. Everything is scoped to one object store keyed
 * by project id, with a recency index so the UI can restore the most recently
 * edited project on load.
 */
export class IndexedDbProjectRepository implements ProjectRepository {
  private readonly dbPromise: Promise<IDBPDatabase<ProjectDb>>

  constructor(dbName: string = DB_NAME) {
    this.dbPromise = openDB<ProjectDb>(dbName, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('projects', { keyPath: 'id' })
        store.createIndex('by-updated', 'updatedAt')
      },
    })
  }

  async list(): Promise<ProjectDocument[]> {
    const db = await this.dbPromise
    const docs = await db.getAllFromIndex('projects', 'by-updated')
    return docs.reverse()
  }

  async get(id: string): Promise<ProjectDocument | null> {
    const db = await this.dbPromise
    return (await db.get('projects', id)) ?? null
  }

  async save(document: ProjectDocument): Promise<void> {
    const db = await this.dbPromise
    await db.put('projects', document)
  }

  async delete(id: string): Promise<void> {
    const db = await this.dbPromise
    await db.delete('projects', id)
  }
}