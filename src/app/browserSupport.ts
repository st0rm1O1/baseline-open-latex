export interface BrowserSupport {
  webAssembly: boolean
  webWorkers: boolean
  indexedDb: boolean
  blob: boolean
}

export const SUPPORT_DESCRIPTIONS: Array<{ key: keyof BrowserSupport; label: string }> = [
  { key: 'webAssembly', label: 'WebAssembly' },
  { key: 'webWorkers', label: 'Web Workers' },
  { key: 'indexedDb', label: 'IndexedDB' },
  { key: 'blob', label: 'Blob APIs' },
]

export function detectBrowserSupport(): BrowserSupport {
  return {
    webAssembly:
      typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function',
    webWorkers: 'Worker' in globalThis,
    indexedDb: typeof indexedDB !== 'undefined',
    blob: typeof Blob !== 'undefined' && typeof URL !== 'undefined' && 'createObjectURL' in URL,
  }
}