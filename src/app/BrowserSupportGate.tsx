import type { ReactNode } from 'react'
import { detectBrowserSupport, SUPPORT_DESCRIPTIONS } from './browserSupport'

/**
 * Blocks the app on devices that cannot run any part of the pipeline
 * (WASM compilation, worker offloading, local persistence).
 */
export function BrowserSupportGate({ children }: { children: ReactNode }) {
  const support = detectBrowserSupport()
  const missing = SUPPORT_DESCRIPTIONS.filter(({ key }) => !support[key])

  if (missing.length === 0) {
    return children
  }

  return (
    <main className="error-state" role="alert">
      <h1>Browser not supported</h1>
      <p>
        This LaTeX editor requires a modern browser with the following capabilities, which are
        missing:
      </p>
      <ul>
        {missing.map(({ key, label }) => (
          <li key={key}>{label}</li>
        ))}
      </ul>
      <p>Please update your browser and reload the page.</p>
    </main>
  )
}