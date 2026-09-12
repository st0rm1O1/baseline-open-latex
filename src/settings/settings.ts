import { createContext, useContext } from 'react'
import type { Settings, SettingsAction } from './settings.types'

export function settingsReducer(settings: Settings, action: SettingsAction): Settings {
  switch (action.type) {
    case 'set-theme':
      return { ...settings, theme: action.theme }
    case 'set-font-size':
      return { ...settings, fontSize: action.fontSize }
    case 'set-auto-compile':
      return { ...settings, autoCompile: action.enabled }
    case 'set-auto-compile-delay':
      return { ...settings, autoCompileDelayMs: action.delayMs }
  }
}

export type SettingsDispatcher = (action: SettingsAction) => void

export const SettingsContext = createContext<{
  settings: Settings
  update: SettingsDispatcher
} | null>(null)

/** Read-only access to settings. Writers must go through `useSettingsActions`. */
export function useSettings(): Settings {
  const context = useContext(SettingsContext)
  if (context === null) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context.settings
}

/** Command surface for mutating settings (CQRS: reads via useSettings, writes here). */
export function useSettingsActions(): SettingsDispatcher {
  const context = useContext(SettingsContext)
  if (context === null) {
    throw new Error('useSettingsActions must be used within a SettingsProvider')
  }
  return context.update
}