export const DEFAULT_FILENAME = 'document.pdf'

/**
 * Characters that are invalid or unsafe in cross-platform filenames.
 * Includes path separators and reserved Windows characters.
 * Control characters (U+0000–U+001F) are removed separately to avoid
 * control-character escapes in the regex literal.
 */
const INVALID_CHARS = /[\\/:*?"<>|]/g
const LEADING_TRAILING = /^[.\s]+|[.\s]+$/g

const isControlCharacter = (char: string): boolean => char.charCodeAt(0) < 32

/** Strip unsafe characters from a proposed filename. */
export function sanitizeFilename(raw: string, fallback: string = DEFAULT_FILENAME): string {
  const cleaned = raw
    .replace(INVALID_CHARS, '')
    .split('')
    .filter((char) => !isControlCharacter(char))
    .join('')
    .replace(LEADING_TRAILING, '')
  return cleaned.length > 0 ? cleaned : fallback
}

/** Derive a download filename from a project name, e.g. "Kunal Resume" -> "Kunal Resume.pdf". */
export function pdfFilenameForProject(projectName: string): string {
  return `${sanitizeFilename(projectName, 'document')}.pdf`
}