export type EditorThemeName = 'light' | 'dark'

export interface Settings {
  /** CodeMirror color theme. */
  theme: EditorThemeName
  /** Editor font size in pixels. */
  fontSize: number
  /** Whether documents auto-compile after a pause in typing. */
  autoCompile: boolean
  /** Debounce delay for auto-compilation, in milliseconds. */
  autoCompileDelayMs: number
}

export type SettingsAction =
  | { type: 'set-theme'; theme: EditorThemeName }
  | { type: 'set-font-size'; fontSize: number }
  | { type: 'set-auto-compile'; enabled: boolean }
  | { type: 'set-auto-compile-delay'; delayMs: number }