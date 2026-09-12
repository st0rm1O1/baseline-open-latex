/**
 * Trigger a browser download directly from memory.
 *
 * The PDF never touches a server: it is handed to the browser as a Blob
 * backed by the compiled bytes. The object URL is revoked promptly so
 * repeated compiles do not leak memory (spec Test 3).
 */
export function downloadBlob(filename: string, data: BlobPart[], type = 'application/pdf'): void {
  const blob = new Blob(data, { type })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}