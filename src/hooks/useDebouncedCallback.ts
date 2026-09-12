import { useCallback, useEffect, useRef } from 'react'

/**
 * Debounced callback factory. Shared by autosave and auto-compile so the
 * debounce semantics are defined in exactly one place.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
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

  useEffect(() => {
    const timer = timerRef.current
    return () => {
      if (timer !== null) {
        clearTimeout(timer)
      }
    }
  }, [])

  return invoke
}