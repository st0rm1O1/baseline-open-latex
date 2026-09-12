/** Lifecycle states of the compiler, shared by the service and hooks. */
export type CompilerStateName =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'compiling'
  | 'success'
  | 'error'
  | 'cancelled'

export interface LatexFile {
  path: string
  content: Uint8Array | string
  type: 'text' | 'binary'
}

export interface LatexProject {
  id: string
  name: string
  entryFile: string
  files: LatexFile[]
}

export interface CompileOptions {
  bibtex?: boolean
  biber?: boolean
  makeindex?: boolean
  rerun?: boolean
}

export interface LatexError {
  message: string
  file?: string
  line?: number
  column?: number
}

export interface LatexWarning {
  message: string
  file?: string
  line?: number
}

export interface CompileResult {
  success: boolean
  pdf?: Uint8Array<ArrayBuffer>
  logs: string[]
  errors: LatexError[]
  warnings: LatexWarning[]
  durationMs: number
}

/**
 * Compiler seam (SOLID: dependency inversion). The rest of the app talks to
 * this interface; the WASM engine only ever lives behind it, in a worker.
 */
export interface CompilerService {
  initialize(): Promise<void>
  compile(project: LatexProject, options?: CompileOptions): Promise<CompileResult>
  cancel(): void
  isReady(): boolean
  terminate(): void
}

export interface CompilerStatus {
  state: CompilerStateName
  message?: string
}