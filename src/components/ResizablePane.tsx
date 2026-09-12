import type { KeyboardEvent, ReactNode } from 'react'
import { useResizablePane } from '../hooks/useResizablePane'

export interface ResizablePaneProps {
  left: ReactNode
  right: ReactNode
  leftAriaLabel: string
  rightAriaLabel: string
}

const KEY_STEP = 0.01

/**
 * Horizontal split with a draggable, keyboard-accessible divider.
 */
export function ResizablePane({ left, right, leftAriaLabel, rightAriaLabel }: ResizablePaneProps) {
  const { containerRef, ratio, startDrag, adjustRatio, dragging } = useResizablePane()

  const leftStyle = { flexBasis: `${ratio * 100}%` }
  const rightStyle = { flexBasis: `${(1 - ratio) * 100}%` }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      adjustRatio(-KEY_STEP)
    } else if (event.key === 'ArrowRight') {
      adjustRatio(KEY_STEP)
    } else {
      return
    }
    event.preventDefault()
  }

  return (
    <div
      ref={containerRef}
      className={`resizable-pane${dragging ? ' resizable-pane--dragging' : ''}`}
    >
      <section className="resizable-pane__panel" style={leftStyle} aria-label={leftAriaLabel}>
        {left}
      </section>
      <div
        className="resizable-pane__divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize editor and preview"
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={handleKeyDown}
      />
      <section className="resizable-pane__panel" style={rightStyle} aria-label={rightAriaLabel}>
        {right}
      </section>
    </div>
  )
}