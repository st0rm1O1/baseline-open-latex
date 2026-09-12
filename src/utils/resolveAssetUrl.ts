/**
 * Resolve an asset path relative to the application's configured base URL.
 *
 * The app is deployed from a GitHub Pages subpath (e.g. `/baseline-open-latex/`),
 * so nothing may assume assets live at the domain root. `import.meta.env.BASE_URL`
 * is guaranteed to end with a slash by Vite.
 */
export function resolveAssetUrl(path: string, baseUrl: string = import.meta.env.BASE_URL): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${cleanBase}${normalized.slice(1)}`
}