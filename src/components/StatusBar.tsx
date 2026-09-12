import type { ReactNode } from 'react'

export interface StatusBarProps {
  /** Compiler/progress status message shown in the bar. */
  status?: string
  /** Optional active-right-aligned content (e.g. mobile view toggle). */
  children?: ReactNode
}

/**
 * Bottom status strip. Describes compiler state (Ready / Initializing /
 * Compiling... / Compiled in 2.4s / Compilation failed).
 */
export function StatusBar({ status = 'Ready', children }: StatusBarProps) {
  return (
    <footer className="statusbar" role="status" aria-live="polite">
      <span className="statusbar__text">{status}</span>
      <div className="statusbar__children">{children}</div>
    </footer>
  )
}