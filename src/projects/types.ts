/**
 * A persisted LaTeX project. Single-file for now; binary assets (fonts,
 * images) are handled via the compiler's virtual file system separately.
 */
export interface ProjectDocument {
  id: string
  name: string
  entryFile: string
  source: string
  updatedAt: number
}

/**
 * Storage seam for projects (SOLID). The app depends on this interface, not
 * on IndexedDB directly, so tests can use an in-memory implementation and
 * the UI can fall back to memory when IndexedDB is unavailable.
 */
export interface ProjectRepository {
  list(): Promise<ProjectDocument[]>
  get(id: string): Promise<ProjectDocument | null>
  save(document: ProjectDocument): Promise<void>
  delete(id: string): Promise<void>
}