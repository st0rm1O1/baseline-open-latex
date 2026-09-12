import type { Settings } from './settings.types'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  fontSize: 14,
  autoCompile: false,
  autoCompileDelayMs: 1000,
}

export const FONT_SIZE_MIN = 10
export const FONT_SIZE_MAX = 28
export const FONT_SIZE_STEP = 1

export const AUTO_COMPILE_DELAY_MIN = 250
export const AUTO_COMPILE_DELAY_MAX = 5000