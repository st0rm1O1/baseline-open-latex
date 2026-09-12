import { useCallback, useEffect, useRef } from 'react'

/**
 * Debounced callback factory. Shared by autosave and auto-compile so the
 * debounce semantics are defined in exactly one place. The returned object
 * exposes `invoke` to schedule (debouncing as usual) and `cancel` to drop any
 * pending invocations, e.g. so a delete can't be followed by a stale save.
 */
export interface DebouncedCallback<Args extends unknown[]> {
  invoke: (...args: Args) => void
  cancel: () => void
}

export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): DebouncedCallback<Args> {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const invoke = useCallback(
    (...args: Args) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        callbackRef.current(...args)
      }, delayMs)
    },
    [delayMs],
  )

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    const timer = timerRef.current
    return () => {
      if (timer !== null) {
        clearTimeout(timer)
      }
    }
  }, [])

  return { invoke, cancel }
}