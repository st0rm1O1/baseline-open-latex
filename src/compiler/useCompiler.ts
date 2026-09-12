import { useCallback, useEffect, useRef, useState } from 'react'
import { CompilersService, isCancellationError } from './CompilersService'
import type { CompileResult, CompilerStateName, CompilerStatus, LatexProject } from './types'
import { downloadBlob } from '../utils/downloadBlob'
import { sanitizeFilename } from '../utils/sanitizeFilename'

export interface CompileActionOptions {
  /** Invoked after a successful compile to download the PDF. */
  download?: boolean
}

export interface UseCompilerResult {
  status: CompilerStatus
  pdfBytes: Uint8Array<ArrayBuffer> | null
  lastResult: CompileResult | null
  /** Monotonically increasing; bumps on every finished compile (success or error). */
  compileRevision: number
  compile: (options?: CompileActionOptions) => Promise<CompileResult | null>
  compileProject: (project: LatexProject) => Promise<CompileResult | null>
  cancel: (() => void) | null
  download: (projectName: string) => void
  /** Clears the compiled PDF and result, e.g. when its project is deleted. */
  reset: () => void
}

const STATUS_TEXT: Record<CompilerStateName, string> = {
  idle: 'Ready',
  initializing: 'Initializing LaTeX engine…',
  ready: 'Ready',
  compiling: 'Compiling…',
  success: 'Compiled',
  error: 'Compilation failed',
  cancelled: 'Compilation cancelled',
}

/**
 * React binding around the compiler service. Owns the state machine and maps
 * worker responses onto status text (consumed by the status bar). The
 * engine is initialized eagerly on mount so the WASM download and preload
 * happen while the user is still reading the placeholder.
 */
export function useCompiler(makeProject: () => LatexProject): UseCompilerResult {
  const serviceRef = useRef<CompilersService | null>(null)
  const [state, setState] = useState<CompilerStateName>('idle')
  const [pdfBytes, setPdfBytes] = useState<Uint8Array<ArrayBuffer> | null>(null)
  const [lastResult, setLastResult] = useState<CompileResult | null>(null)
  const [compileRevision, setCompileRevision] = useState(0)

  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = new CompilersService()
    }
    return serviceRef.current
  }, [])

  const runCompile = useCallback(
    async (project: LatexProject): Promise<CompileResult | null> => {
      const service = getService()
      try {
        if (!service.isReady()) {
          setState('initializing')
          await service.initialize()
        }
        setState('compiling')
        setPdfBytes(null)
        const result = await service.compile(project)
        setLastResult(result)
        setCompileRevision((previous) => previous + 1)
        if (result.success && result.pdf) {
          setPdfBytes(result.pdf)
          setState('success')
        } else {
          setState('error')
        }
        return result
      } catch (error) {
        setCompileRevision((previous) => previous + 1)
        if (isCancellationError(error)) {
          setState('cancelled')
        } else {
          setState('error')
        }
        return null
      }
    },
    [getService],
  )

  const compile = useCallback(
    (options?: CompileActionOptions): Promise<CompileResult | null> => {
      return runCompile(makeProject())
        .then((result) => {
          if (options?.download && result?.success && result.pdf) {
            downloadBlob('compiled.pdf', [result.pdf], 'application/pdf')
          }
          return result
        })
    },
    [runCompile, makeProject],
  )

  const compileProject = useCallback(
    (project: LatexProject): Promise<CompileResult | null> => runCompile(project),
    [runCompile],
  )

  const cancel = useCallback((): void => {
    getService().cancel()
  }, [getService])

  const download = useCallback(
    (projectName: string): void => {
      if (!pdfBytes) return
      const base = sanitizeFilename(projectName) || 'compiled'
      downloadBlob(`${base}.pdf`, [pdfBytes], 'application/pdf')
    },
    [pdfBytes],
  )

  const reset = useCallback(() => {
    setPdfBytes(null)
    setLastResult(null)
    setCompileRevision((previous) => previous + 1)
    setState('idle')
  }, [])

  useEffect(() => {
    const service = getService()
    void service.initialize().then(
      () => setState((previous) => (previous === 'idle' ? 'ready' : previous)),
      () => setState('error'),
    )
    const serviceRefCurrent = service
    return () => {
      serviceRefCurrent.terminate()
    }
  }, [getService])

  const status: CompilerStatus = {
    state,
    message: state === 'success' && lastResult ? `${STATUS_TEXT[state]} in ${(lastResult.durationMs / 1000).toFixed(1)}s` : STATUS_TEXT[state],
  }

  return {
    status,
    pdfBytes,
    lastResult,
    compileRevision,
    compile,
    compileProject,
    cancel: state === 'compiling' ? cancel : null,
    download,
    reset,
  }
}