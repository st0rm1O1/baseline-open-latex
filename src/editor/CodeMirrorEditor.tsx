import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { EditorThemeName } from '../settings/settings.types'
import { STATIC_EXTENSIONS, reconfigureEditor, themeExtensions } from './editor.extensions'

export interface CodeMirrorEditorHandle {
  /** Move the cursor to a 1-based line (used by error navigation). */
  scrollToLine(line: number): void
  focus(): void
}

export interface CodeMirrorEditorProps {
  value: string
  onChange: (value: string) => void
  theme: EditorThemeName
  fontSize: number
  readOnly?: boolean
  ariaLabel: string
}

/**
 * Thin React wrapper around a CodeMirror 6 EditorView. The view is created
 * once and reconfigured in place when theme/font size change; document
 * updates flow through the `onChange` prop exactly like a controlled input.
 */
export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, CodeMirrorEditorProps>(
  function CodeMirrorEditor(
    { value, onChange, theme, fontSize, readOnly = false, ariaLabel },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange
    const valueRef = useRef(value)
    valueRef.current = value

    // Create the EditorView exactly once; all later changes go through
    // reconfigure() or doc replacements below.
    useEffect(() => {
      const container = containerRef.current
      if (container === null) {
        return
      }

      const view = new EditorView({
        parent: container,
        state: EditorState.create({
          doc: valueRef.current,
          extensions: [
            ...STATIC_EXTENSIONS,
            ...themeExtensions(theme, fontSize),
            EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
            EditorState.readOnly.of(readOnly),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onChangeRef.current(update.state.doc.toString())
              }
            }),
          ],
        }),
      })

      viewRef.current = view
      return () => {
        view.destroy()
        viewRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Re-theme / resize without recreating the editor.
    useEffect(() => {
      const view = viewRef.current
      if (view !== null) {
        reconfigureEditor(view, theme, fontSize)
      }
    }, [theme, fontSize])

    // Reflect external document changes (project loads, undo of autosave, etc.).
    useEffect(() => {
      const view = viewRef.current
      if (view === null) {
        return
      }
      const current = view.state.doc.toString()
      if (current !== value) {
        view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
      }
    }, [value])

    useImperativeHandle(
      ref,
      () => ({
        scrollToLine(line: number) {
          const view = viewRef.current
          if (view === null || line < 1) {
            return
          }
          const clamped = Math.min(Math.max(line, 1), view.state.doc.lines)
          const pos = view.state.doc.line(clamped).from
          view.dispatch({
            selection: { anchor: pos },
            scrollIntoView: true,
          })
          view.focus()
        },
        focus() {
          viewRef.current?.focus()
        },
      }),
      [],
    )

    return <div ref={containerRef} className="code-mirror-editor" />
  },
)