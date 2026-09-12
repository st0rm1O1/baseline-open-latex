import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Opens a PDF from raw bytes, resolving to the document proxy. */
export function openPdfDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ data: bytes }).promise
}

export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'