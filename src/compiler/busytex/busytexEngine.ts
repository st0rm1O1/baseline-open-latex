import { BusyTexRunner, XeLatex } from 'texlyre-busytex'
import type { WorkerRequest } from '../protocol'

type InitializeRequest = Extract<WorkerRequest, { type: 'initialize' }>
type CompileRequest = Extract<WorkerRequest, { type: 'compile' }>

let runner: BusyTexRunner | null = null
let xelatex: XeLatex | null = null

export async function initializeEngine(request: InitializeRequest): Promise<void> {
  if (runner) return
  runner = new BusyTexRunner({
    busytexBasePath: request.busytexBasePath,
    preloadDataPackages: request.preloadDataPackages,
  })
  // Run the engine inside a nested worker managed by BusyTexRunner.
  await runner.initialize(true)
  xelatex = new XeLatex(runner)
}

export function terminateEngine(): void {
  runner?.terminate()
  runner = null
  xelatex = null
}

export async function compileWithEngine(request: CompileRequest) {
  if (!runner || !xelatex) {
    throw new Error('Engine is not initialized')
  }
  const additionalFiles = request.additionalFiles.map((file) => ({
    path: file.path,
    content: file.content instanceof ArrayBuffer ? new Uint8Array(file.content) : file.content,
  }))
  return xelatex.compile({
    input: request.input,
    mainTexPath: request.mainTexPath,
    additionalFiles,
    bibtex: request.bibtex || undefined,
    rerun: request.rerun || undefined,
    remoteEndpoint: request.remoteEndpoint,
  })
}