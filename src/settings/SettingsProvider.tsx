import { useCallback, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { SettingsContext, settingsReducer } from './settings'
import { DEFAULT_SETTINGS } from './settings.defaults'
import type { SettingsAction } from './settings.types'

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, dispatch] = useReducer(settingsReducer, DEFAULT_SETTINGS)

  const update = useCallback((action: SettingsAction) => {
    dispatch(action)
  }, [])

  const value = useMemo(() => ({ settings, update }), [settings, update])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}