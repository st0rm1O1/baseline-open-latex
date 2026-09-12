import type { CompilerStatus } from '../compiler/types'

interface PdfPlaceholderProps {
  status?: CompilerStatus
}

/**
 * Preview shown before the first successful compilation. Replaced by the
 * PDF.js viewer (PdfViewer) once a PDF exists.
 */
export function PdfPlaceholder({ status }: PdfPlaceholderProps) {
  const state = status?.state ?? 'idle'
  const hint =
    state === 'compiling' || state === 'initializing'
      ? status?.message
      : state === 'error'
        ? 'Compilation ran into an error. Fix the source and compile again.'
        : undefined

  return (
    <div className="pdf-placeholder" aria-label="PDF preview not yet available">
      <p className="pdf-placeholder__icon" aria-hidden="true">
        PDF
      </p>
      <h2 className="pdf-placeholder__title">No PDF yet</h2>
      <p className="pdf-placeholder__hint">
        {hint ?? (
          <>
            Click <strong>Compile</strong> to compile this LaTeX document entirely in your browser.
          </>
        )}
      </p>
    </div>
  )
}