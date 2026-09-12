import { BUSYTEX_BASE_PATH, PRELOAD_DATA_PACKAGES, REMOTE_ENDPOINT } from './busytex/engineConfig'
import { CompilationCancelledError, CompilersClient } from './CompilersClient'
import type { CompileOptions, CompileResult, CompilerService, LatexProject } from './types'

/**
 * Real compiler implementation over the worker client. Owns lifecycle state
 * and translates worker failures into typed errors the UI understands.
 */
export class CompilersService implements CompilerService {
  private readonly client = CompilersClient.create({
    busytexBasePath: BUSYTEX_BASE_PATH,
    preloadDataPackages: PRELOAD_DATA_PACKAGES,
  })
  private engineReady = false
  private initializing: Promise<void> | null = null

  async initialize(): Promise<void> {
    if (this.engineReady) return
    if (this.initializing) return this.initializing
    this.initializing = this.client.initialize().then(() => {
      this.engineReady = true
      this.initializing = null
    })
    return this.initializing
  }

  async compile(project: LatexProject, options: CompileOptions = {}): Promise<CompileResult> {
    if (!this.engineReady) {
      await this.initialize()
    }
    const entry = project.files.find((file) => file.path === project.entryFile)
    if (!entry || typeof entry.content !== 'string') {
      throw new Error(`Entry file "${project.entryFile}" is missing or not a text file`)
    }
    const additionalFiles = project.files
      .filter((file) => file.path !== project.entryFile)
      .map((file) => ({
        path: file.path,
        content: file.content instanceof Uint8Array ? (file.content.buffer as ArrayBuffer) : file.content,
      }))

    return this.client.compile({
      mainTexPath: project.entryFile,
      input: entry.content,
      additionalFiles,
      bibtex: options.bibtex ?? false,
      rerun: options.rerun ?? false,
      remoteEndpoint: REMOTE_ENDPOINT,
    })
  }

  cancel(): void {
    this.client.cancel()
  }

  isReady(): boolean {
    return this.engineReady
  }

  terminate(): void {
    this.client.terminate()
    this.engineReady = false
    this.initializing = null
  }
}

export function isCancellationError(error: unknown): boolean {
  return error instanceof CompilationCancelledError
}