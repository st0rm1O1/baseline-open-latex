import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface AppErrorBoundaryState {
  hasError: boolean
  message: string
}

/**
 * Top-level error boundary. A failure in any subsystem (compiler, PDF
 * rendering, persistence, UI) must not blank the whole application.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Unhandled application error', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }
    return (
      <main className="error-state" role="alert">
        <h1>Something went wrong</h1>
        <p>{this.state.message}</p>
        <p>
          Your projects are safe. Reload the page to continue; unsaved edits in the current
          document will be lost.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload application
        </button>
      </main>
    )
  }
}