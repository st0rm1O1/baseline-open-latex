import { resolveAssetUrl } from '../../utils/resolveAssetUrl'

export const BUSYTEX_BASE_PATH = resolveAssetUrl('busytex')
export const PRELOAD_DATA_PACKAGES = [`${BUSYTEX_BASE_PATH}/texlive-basic.js`]

/**
 * Public TeX Live 2026 endpoint used for packages/fonts beyond the bundled
 * texlive-basic tier (fontspec, fontawesome5, titleSec, tex-gyre, ...).
 * Results are cached by the engine inside IndexedDB for later offline use.
 */
export const REMOTE_ENDPOINT = 'https://texlive2026.texlyre.org'