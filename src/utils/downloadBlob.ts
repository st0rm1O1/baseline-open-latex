/**
 * Trigger a browser download directly from memory.
 *
 * The PDF never touches a server: it is handed to the browser as a Blob
 * backed by the compiled bytes. The object URL is revoked only after a
 * generous delay: some browsers abort the download and save a 0-byte file
 * if the URL is revoked while the download is still starting. The timer
 * still bounds the leak, releasing each download's URL after a fixed delay.
 */
const REVOKE_DELAY_MS = 10_000

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

  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}