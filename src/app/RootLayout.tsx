import { useState } from 'react'
import type { ReactNode } from 'react'
import { ResizablePane } from '../components/ResizablePane'
import { StatusBar } from '../components/StatusBar'
import { TopBar } from '../components/TopBar'
import type { TopBarProps } from '../components/TopBar'
import { useMediaQuery } from '../hooks/useMediaQuery'

const MOBILE_QUERY = '(max-width: 760px)'

export type MobileView = 'editor' | 'preview'

export interface RootLayoutProps extends TopBarProps {
  editor: ReactNode
  preview: ReactNode
  /** Compiler status text shown in the status bar. */
  status?: string
}

/**
 * Three-zone application shell: topbar / editor+preview workspace / status bar.
 * On mobile the single visible zone is selected with a toggle instead of
 * forcing a permanent two-column layout. The hidden pane stays mounted so the
 * editor keeps its undo history and focus state.
 */
export function RootLayout({ editor, preview, status, ...topBarProps }: RootLayoutProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const [mobileView, setMobileView] = useState<MobileView>('editor')

  return (
    <div className="app-shell">
      <TopBar {...topBarProps} />
      {isMobile ? (
        <div className="mobile-tabs" role="tablist" aria-label="Switch view">
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'editor'}
            className={mobileView === 'editor' ? 'button button--compact is-active' : 'button button--compact'}
            onClick={() => setMobileView('editor')}
          >
            Editor
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'preview'}
            className={mobileView === 'preview' ? 'button button--compact is-active' : 'button button--compact'}
            onClick={() => setMobileView('preview')}
          >
            Preview
          </button>
        </div>
      ) : null}
      {isMobile ? (
        <div className="mobile-view">
          <div className="mobile-view__pane" hidden={mobileView !== 'editor'}>
            {editor}
          </div>
          <div className="mobile-view__pane" hidden={mobileView !== 'preview'}>
            {preview}
          </div>
        </div>
      ) : (
        <ResizablePane
          left={editor}
          right={preview}
          leftAriaLabel="LaTeX source editor"
          rightAriaLabel="PDF preview"
        />
      )}
      <StatusBar status={status} />
    </div>
  )
}