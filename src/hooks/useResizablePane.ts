import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseResizablePaneOptions {
  /** Editor share of the width, 0..1. */
  initialRatio?: number
  minRatio?: number
  maxRatio?: number
}

export interface UseResizablePaneResult {
  containerRef: React.RefObject<HTMLDivElement | null>
  /** 0..1 share of the first pane. */
  ratio: number
  /** Call from onPointerDown on the divider handle. */
  startDrag: (event: React.PointerEvent<HTMLDivElement>) => void
  /** Move the divider by a fraction of the width (keyboard access). */
  adjustRatio: (delta: number) => void
  dragging: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Drag-to-resize horizontal split between editor and preview panes.
 * The ratio is a fraction of the container width; values are clamped so
 * neither pane can collapse entirely.
 */
export function useResizablePane({
  initialRatio = 0.5,
  minRatio = 0.2,
  maxRatio = 0.8,
}: UseResizablePaneOptions = {}): UseResizablePaneResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [ratio, setRatio] = useState(initialRatio)
  const [dragging, setDragging] = useState(false)

  const startDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(true)
  }, [])

  const adjustRatio = useCallback(
    (delta: number) => {
      setRatio((current) => clamp(current + delta, minRatio, maxRatio))
    },
    [minRatio, maxRatio],
  )

  useEffect(() => {
    if (!dragging) {
      return
    }

    const handleMove = (event: PointerEvent) => {
      const container = containerRef.current
      if (container === null) {
        return
      }
      const rect = container.getBoundingClientRect()
      if (rect.width === 0) {
        return
      }
      const nextRatio = (event.clientX - rect.left) / rect.width
      setRatio(clamp(nextRatio, minRatio, maxRatio))
    }

    const handleUp = () => {
      setDragging(false)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dragging, minRatio, maxRatio])

  return { containerRef, ratio, startDrag, adjustRatio, dragging }
}