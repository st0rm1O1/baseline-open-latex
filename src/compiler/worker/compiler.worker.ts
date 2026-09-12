import { compileWithEngine, initializeEngine } from '../busytex/busytexEngine'
import { parseLatexLog } from '../parseLatexLog'
import type { WorkerRequest, WorkerResponse } from '../protocol'

const scope = self as unknown as DedicatedWorkerGlobalScope
let ready = false

function buffersOf(response: WorkerResponse): ArrayBuffer[] {
  if (response.type === 'compile-success') {
    return [response.pdf]
  }
  return []
}

function post(response: WorkerResponse): void {
  scope.postMessage(response, buffersOf(response))
}

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data

  switch (message.type) {
    case 'initialize': {
      try {
        await initializeEngine(message)
        ready = true
        post({ type: 'initialized', requestId: message.requestId })
      } catch (error) {
        post({ type: 'initialize-error', requestId: message.requestId, message: String(error) })
      }
      break
    }

    case 'compile': {
      if (!ready) {
        post({ type: 'compile-exception', requestId: message.requestId, message: 'Compiler worker is not initialized' })
        break
      }
      const startedAt = performance.now()
      try {
        const result = await compileWithEngine(message)
        const durationMs = Math.round(performance.now() - startedAt)
        const { errors, warnings } = parseLatexLog(result.log, message.mainTexPath)
        if (result.success && result.pdf) {
          post({
            type: 'compile-success',
            requestId: message.requestId,
            pdf: result.pdf.buffer as ArrayBuffer,
            log: result.log,
            errors,
            warnings,
            durationMs,
          })
        } else {
          post({
            type: 'compile-error',
            requestId: message.requestId,
            log: result.log,
            errors,
            warnings,
            durationMs,
          })
        }
      } catch (error) {
        post({ type: 'compile-exception', requestId: message.requestId, message: String(error) })
      }
      break
    }

    case 'cancel': {
      // WASM compilation cannot be preempted; the client discards stale
      // results via its requestId guard. Nothing to do here except keep
      // the worker alive for the next compile.
      break
    }
  }
}