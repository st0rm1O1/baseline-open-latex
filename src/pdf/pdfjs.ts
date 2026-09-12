import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Opens a PDF from raw bytes, resolving to the document proxy. */
export function openPdfDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  // pdf.js transfers the passed buffer to its worker, detaching it. Copy so
  // the caller's bytes (e.g. the compiler's pdfBytes used for downloading)
  // remain intact after the preview has rendered.
  return pdfjs.getDocument({ data: bytes.slice() }).promise
}

export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'