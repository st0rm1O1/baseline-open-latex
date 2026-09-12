import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { openPdfDocument } from './pdfjs'

const ZOOM_STEPS = 1.25
const MIN_SCALE = 0.25
const MAX_SCALE = 6

interface PdfViewState {
  doc: PDFDocumentProxy | null
  error: string | null
  page: number
  pageCount: number
}

interface PdfViewerProps {
  pdfBytes: Uint8Array<ArrayBuffer>
}

/**
 * PDF preview: renders every page into a stacked set of canvases rasterized
 * by PDF.js inside its own worker. Rasterization happens once per scale
 * change rather than once per paint.
 */
export function PdfViewer({ pdfBytes }: PdfViewerProps) {
  const [view, setView] = useState<PdfViewState>({ doc: null, error: null, page: 1, pageCount: 0 })
  const [scale, setScale] = useState(1)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pageNodeRefs = useRef<Array<HTMLCanvasElement | null>>([])

  useEffect(() => {
    let cancelled = false
    let doc: PDFDocumentProxy | null = null
    openPdfDocument(pdfBytes)
      .then((nextDoc) => {
        if (cancelled) {
          void nextDoc.destroy()
          return
        }
        doc = nextDoc
        return nextDoc.getPage(1).then((firstPage) => {
          if (cancelled) return
          const widthScale = firstPage.getViewport({ scale: 1 }).width / 800
          setScale(Math.min(Math.max(widthScale, MIN_SCALE), 1))
          setView({ doc: nextDoc, error: null, page: 1, pageCount: nextDoc.numPages })
        })
      })
      .catch((error: unknown) => {
        if (!cancelled) setView((previous) => ({ ...previous, error: String(error) }))
      })
    return () => {
      cancelled = true
      void doc?.destroy()
    }
  }, [pdfBytes])

  // Rasterize all pages. Depends only on the document and the scale, so it
  // re-runs on zoom but not on scroll/page changes.
  const { doc, error } = view
  useEffect(() => {
    if (!doc || error) return
    let cancelled = false
    const nodes = pageNodeRefs.current
    nodes.length = doc.numPages
    const dpr = window.devicePixelRatio || 1
    for (let index = 0; index < doc.numPages; index += 1) {
      const canvas = nodes[index]
      if (!canvas) continue
      const pageNumber = index + 1
      doc
        .getPage(pageNumber)
        .then(async (page) => {
          if (cancelled) return
          const viewport = page.getViewport({ scale: scale * dpr })
          canvas.width = Math.max(1, Math.floor(viewport.width))
          canvas.height = Math.max(1, Math.floor(viewport.height))
          canvas.style.width = `${Math.floor(viewport.width / dpr)}px`
          canvas.style.height = `${Math.floor(viewport.height / dpr)}px`
          canvas.dataset.page = String(pageNumber)
          const context = canvas.getContext('2d')
          if (!context) return
          await page.render({ canvas, canvasContext: context, viewport }).promise
        })
        .catch(() => {
          if (!cancelled) setView((previous) => ({ ...previous, error: 'Failed to render a PDF page' }))
        })
    }
    return () => {
      cancelled = true
    }
  }, [doc, error, scale])

  useEffect(() => {
    const handleScroll = () => {
      const container = scrollRef.current
      if (!container) return
      const top = container.scrollTop + container.clientHeight / 2
      let current = 1
      for (const node of pageNodeRefs.current) {
        if (!node) continue
        if (node.offsetTop <= top) current = Number(node.dataset.page) || current
      }
      setView((previous) => (previous.page === current ? previous : { ...previous, page: current }))
    }
    const container = scrollRef.current
    container?.addEventListener('scroll', handleScroll)
    return () => container?.removeEventListener('scroll', handleScroll)
  }, [])

  const zoomBy = (factor: number) => {
    setScale((previous) => Math.min(Math.max(previous * factor, MIN_SCALE), MAX_SCALE))
  }

  const goToPage = (page: number) => {
    pageNodeRefs.current[page - 1]?.scrollIntoView({ block: 'start' })
  }

  if (view.error) {
    return (
      <div className="pdf-error" role="alert">
        <p className="pdf-error__title">Could not open the PDF</p>
        <p className="pdf-error__message">{view.error}</p>
      </div>
    )
  }

  if (!view.doc) {
    return (
      <div className="pdf-loading" role="status">
        Loading PDF…
      </div>
    )
  }

  const previousDisabled = view.page <= 1
  const nextDisabled = view.page >= view.pageCount

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar" role="toolbar" aria-label="PDF preview controls">
        <div className="pdf-toolbar__group">
          <button
            type="button"
            className="button button--compact"
            disabled={previousDisabled}
            onClick={() => goToPage(view.page - 1)}
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="pdf-toolbar__page" aria-label={`Page ${view.page} of ${view.pageCount}`}>
            {view.page}/{view.pageCount}
          </span>
          <button
            type="button"
            className="button button--compact"
            disabled={nextDisabled}
            onClick={() => goToPage(view.page + 1)}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
        <div className="pdf-toolbar__group">
          <button
            type="button"
            className="button button--compact"
            onClick={() => zoomBy(1 / ZOOM_STEPS)}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="pdf-toolbar__zoom">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="button button--compact"
            onClick={() => zoomBy(ZOOM_STEPS)}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>
      <div className="pdf-scroll" ref={scrollRef}>
        {Array.from({ length: view.pageCount }, (_, index) => (
          <canvas
            key={index}
            ref={(node) => {
              pageNodeRefs.current[index] = node
            }}
            className="pdf-page"
          />
        ))}
      </div>
    </div>
  )
}