import type { LatexError, LatexWarning } from './types'

const ERROR_START = /^!\s+(.*)$/
const LINE_NUMBER = /^l\.(\d+)$/
const ERROR_LINE = /^l\.(\d+)\s+(.*)$/
const WARNING_START =
  /^(Overfull|Underfull|LaTeX Warning:|Package \w+ Warning:|Warning:.*undefined|There were undefined references)/i
const LOADED_FILE = /^\((\.\\)?([^)\s]+\.[A-Za-z]{1,4})/i

/**
 * Best-effort diagnostics extraction from a TeX transcript log.
 * The log format is notoriously irregular; this covers the common,
 * stable shapes: `! message` errors with `l.<n>` lines, and
 * Overfull/Underfull/LaTeX/Package warnings.
 */
export function parseLatexLog(log: string, mainFile: string): { errors: LatexError[]; warnings: LatexWarning[] } {
  const errors: LatexError[] = []
  const warnings: LatexWarning[] = []
  const lines = log.split(/\r?\n/)
  let currentFile = mainFile
  let pendingError: LatexError | null = null

  const flush = () => {
    if (pendingError) {
      if (pendingError.file === undefined) pendingError.file = currentFile
      errors.push(pendingError)
      pendingError = null
    }
  }

  for (const line of lines) {
    const loaded = LOADED_FILE.exec(line)
    if (loaded) {
      currentFile = loaded[2] ?? mainFile
    }

    if (pendingError) {
      const lineMatch = LINE_NUMBER.exec(line)
      if (lineMatch) {
        pendingError.line = Number(lineMatch[1] ?? 0)
        flush()
        continue
      }
      const contentMatch = ERROR_LINE.exec(line)
      if (contentMatch) {
        pendingError.line = Number(contentMatch[1] ?? 0)
        flush()
        continue
      }
      // Blank lines and explanation text still belong to the current error
      // block; only a fresh `!` line or end-of-run text closes it.
      if (line.startsWith('! ')) {
        flush()
        pendingError = { message: line.slice(2).trim() }
        continue
      }
      if (line.startsWith('No pages of output')) {
        flush()
        pendingError = null
        continue
      }
      continue
    }

    const withLine = ERROR_LINE.exec(line)
    if (withLine) {
      flush()
      errors.push({ message: withLine[2]?.trim() ?? '', file: currentFile, line: Number(withLine[1] ?? 0) })
      continue
    }

    const errorMatch = ERROR_START.exec(line)
    if (errorMatch) {
      flush()
      pendingError = { message: errorMatch[1]?.trim() ?? '' }
      continue
    }

    if (WARNING_START.test(line)) {
      warnings.push({ message: line.trim(), file: currentFile })
    }
  }

  flush()
  return { errors, warnings }
}