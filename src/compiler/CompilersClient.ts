import type { CompileResult } from './types'
import type { WorkerRequest, WorkerResponse } from './protocol'
import workerUrl from './worker/compiler.worker.ts?worker&url'

export interface CompilerClientConfig {
  busytexBasePath: string
  preloadDataPackages: string[]
}

export class CompilationSupersededError extends Error {
  constructor() {
    super('Compilation was superseded by a newer request')
    this.name = 'CompilationSupersededError'
  }
}

export class CompilationCancelledError extends Error {
  constructor() {
    super('Compilation was cancelled')
    this.name = 'CompilationCancelledError'
  }
}

/**
 * Thin message-passing client over the dedicated compile worker.
 * Single in-flight compile; responses for stale request ids are discarded
 * (spec: a slow compile must never overwrite the freshest result).
 */
export class CompilersClient {
  private worker: Worker | null = null
  private config: CompilerClientConfig | null = null
  private seq = 0
  private inFlightId: number | null = null
  private pending = new Map<
    number,
    { resolve: (value: WorkerResponse) => void; reject: (reason: Error) => void }
  >()

  private constructor() {}

  static create(config: CompilerClientConfig): CompilersClient {
    const client = new CompilersClient()
    client.config = config
    client.start()
    return client
  }

  private start(): void {
    const worker = new Worker(workerUrl, { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handleResponse(event.data)
    worker.onerror = (event) => {
      const raw = event.error instanceof Error ? event.error : null
      console.error('[worker onerror]', raw?.stack ?? event.message, event)
      const reason = new Error(raw?.message ?? event.message ?? 'Compilation worker failed')
      for (const { reject } of this.pending.values()) {
        reject(reason)
      }
      this.pending.clear()
      this.inFlightId = null
    }
    this.worker = worker
  }

  private post(request: Omit<WorkerRequest, 'requestId'> & { requestId: number }): void {
    if (!this.worker) {
      throw new Error('CompilersClient has been terminated')
    }
    this.worker.postMessage(request)
  }

  private nextRequestId(): number {
    this.seq += 1
    return this.seq
  }

  async initialize(): Promise<void> {
    if (!this.config) {
      throw new Error('CompilersClient has no engine configuration')
    }
    const requestId = this.nextRequestId()
    const response = await this.exchange(requestId, {
      type: 'initialize',
      requestId,
      busytexBasePath: this.config.busytexBasePath,
      preloadDataPackages: this.config.preloadDataPackages,
    })
    if (response.type === 'initialize-error') {
      throw new Error(response.message)
    }
  }

  compile(args: {
    mainTexPath: string
    input: string
    additionalFiles: Array<{ path: string; content: string | ArrayBuffer }>
    bibtex: boolean
    rerun: boolean
    remoteEndpoint: string
  }): Promise<CompileResult> {
    const requestId = this.nextRequestId()
    // Supersede any in-flight compile: its (late) result must be discarded.
    if (this.inFlightId !== null) {
      const previous = this.pending.get(this.inFlightId)
      if (previous) {
        this.pending.delete(this.inFlightId)
        previous.reject(new CompilationSupersededError())
      }
    }
    this.inFlightId = requestId

    return this.exchange(requestId, {
      type: 'compile',
      requestId,
      ...args,
    }).then((response) => {
      switch (response.type) {
        case 'compile-success':
          return {
            success: true,
            pdf: new Uint8Array(response.pdf),
            logs: [response.log],
            errors: response.errors,
            warnings: response.warnings,
            durationMs: response.durationMs,
          } satisfies CompileResult
        case 'compile-error':
          return {
            success: false,
            logs: [response.log],
            errors: response.errors,
            warnings: response.warnings,
            durationMs: response.durationMs,
          } satisfies CompileResult
        default:
          throw new Error(response.type === 'compile-exception' ? response.message : 'Unexpected worker response')
      }
    })
  }

  /** Marks the in-flight compile as cancelled; WASM itself keeps running. */
  cancel(): void {
    if (this.inFlightId === null) return
    const lastId = this.inFlightId
    this.inFlightId = null
    const waiter = this.pending.get(lastId)
    if (waiter) {
      this.pending.delete(lastId)
      waiter.reject(new CompilationCancelledError())
    }
    this.post({ type: 'cancel', requestId: lastId })
  }

  terminate(): void {
    this.pending.clear()
    this.inFlightId = null
    this.worker?.terminate()
    this.worker = null
  }

  private exchange(requestId: number, request: WorkerRequest): Promise<WorkerResponse> {
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.post(request)
    })
  }

  private handleResponse(response: WorkerResponse): void {
    // Stale-guard: only the freshest compile may resolve; older latches drop.
    if (response.type.startsWith('compile')) {
      if (response.requestId !== this.inFlightId) return
      this.inFlightId = null
    }
    const waiter = this.pending.get(response.requestId)
    if (!waiter) return
    this.pending.delete(response.requestId)
    waiter.resolve(response)
  }
}