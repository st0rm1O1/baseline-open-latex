import type { ProjectDocument, ProjectRepository } from './types'

/** In-memory repository used in tests and when IndexedDB is unavailable. */
export class MemoryProjectRepository implements ProjectRepository {
  private readonly documents = new Map<string, ProjectDocument>()

  async list(): Promise<ProjectDocument[]> {
    return [...this.documents.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async get(id: string): Promise<ProjectDocument | null> {
    return this.documents.get(id) ?? null
  }

  async save(document: ProjectDocument): Promise<void> {
    this.documents.set(document.id, { ...document })
  }

  async delete(id: string): Promise<void> {
    this.documents.delete(id)
  }
}