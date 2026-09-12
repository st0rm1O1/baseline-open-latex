import {
  bracketMatching,
  defaultHighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language'
import { StreamLanguage } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import {
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  EditorView,
} from '@codemirror/view'
import { search, searchKeymap } from '@codemirror/search'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import { oneDark } from '@codemirror/theme-one-dark'
import type { EditorThemeName } from '../settings/settings.types'

const fontThemeCompartment = new Compartment()
const colorThemeCompartment = new Compartment()

export { fontThemeCompartment, colorThemeCompartment }

/**
 * Static set of editor capabilities that never change: LaTeX syntax
 * highlighting (stream parser), line numbers, bracket matching, active-line
 * highlighting, indentation, plus search/replace and standard keymaps.
 */
export const STATIC_EXTENSIONS: Extension[] = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightActiveLine(),
  bracketMatching(),
  closeBrackets(),
  history(),
  StreamLanguage.define(stex),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  indentUnit.of('  '),
  EditorState.tabSize.of(4),
  search({ top: true }),
  keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),
]

const fontTheme = (fontSize: number): Extension =>
  EditorView.theme({ '&': { fontSize: `${fontSize}px` } })

const colorTheme = (theme: EditorThemeName): Extension => (theme === 'dark' ? oneDark : [])

export const themeExtensions = (theme: EditorThemeName, fontSize: number): Extension[] => [
  fontThemeCompartment.of(fontTheme(fontSize)),
  colorThemeCompartment.of(colorTheme(theme)),
]

/** Reconfigure font size and color theme without tearing the editor down. */
export function reconfigureEditor(
  view: EditorView,
  theme: EditorThemeName,
  fontSize: number,
): void {
  view.dispatch({
    effects: [
      fontThemeCompartment.reconfigure(fontTheme(fontSize)),
      colorThemeCompartment.reconfigure(colorTheme(theme)),
    ],
  })
}