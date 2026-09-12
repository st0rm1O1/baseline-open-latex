import type { LatexError, LatexWarning } from './types'

/** A file travelling across the worker boundary: string for text, ArrayBuffer for binary. */
export interface CompilePayloadFile {
  path: string
  content: string | ArrayBuffer
}

export type WorkerRequest =
  | {
      type: 'initialize'
      requestId: number
      busytexBasePath: string
      preloadDataPackages: string[]
    }
  | {
      type: 'compile'
      requestId: number
      mainTexPath: string
      input: string
      additionalFiles: CompilePayloadFile[]
      bibtex: boolean
      rerun: boolean
      remoteEndpoint: string
    }
  | {
      type: 'cancel'
      requestId: number
    }

export type WorkerResponse =
  | { type: 'initialized'; requestId: number }
  | { type: 'initialize-error'; requestId: number; message: string }
  | {
      type: 'compile-success'
      requestId: number
      pdf: ArrayBuffer
      log: string
      errors: LatexError[]
      warnings: LatexWarning[]
      durationMs: number
    }
  | {
      type: 'compile-error'
      requestId: number
      log: string
      errors: LatexError[]
      warnings: LatexWarning[]
      durationMs: number
    }
  | { type: 'compile-exception'; requestId: number; message: string }