import { describe, expect, it } from 'vitest'
import { parseLatexLog } from '../src/compiler/parseLatexLog'

describe('parseLatexLog', () => {
  it('extracts a LaTeX error with its line number', () => {
    const log = [
      '! LaTeX Error: File `nope.sty` not found.',
      '',
      "Type X to quit or <RETURN> to proceed,",
      'or enter new name. (Default extension: sty)',
      '',
      'Enter file name:',
      'l.5 \\usepackage{nope}',
      '',
      'No pages of output.',
    ].join('\n')

    const { errors } = parseLatexLog(log, 'main.tex')
    expect(errors).toEqual([
      expect.objectContaining({ message: 'LaTeX Error: File `nope.sty` not found.', file: 'main.tex', line: 5 }),
    ])
  })

  it('extracts an undefined control sequence error', () => {
    const log = '! Undefined control sequence.\n<argument> \\blah\nl.7 \\title{Hello \\blah}\n'
    const { errors } = parseLatexLog(log, 'main.tex')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toEqual(
      expect.objectContaining({ message: 'Undefined control sequence.', line: 7, file: 'main.tex' }),
    )
  })

  it('captures several consecutive errors', () => {
    const log = '! Error one.\nl.1\n' + '\n! Error two.\nl.2\n'
    const { errors } = parseLatexLog(log, 'main.tex')
    expect(errors.map((e) => [e.message, e.line])).toEqual([
      ['Error one.', 1],
      ['Error two.', 2],
    ])
  })

  it('attributes warnings to their own line', () => {
    const log = [
      'Overfull hbox (12.34567pt too wide) in paragraph at lines 3--5',
      'Underfull vbox (badness 1234) has occurred while output is active',
      'LaTeX Warning: Citation 42 is undefined on line 9.',
    ].join('\n')
    const { warnings } = parseLatexLog(log, 'main.tex')
    expect(warnings).toHaveLength(3)
  })

  it('returns no diagnostics for a clean log', () => {
    const { errors, warnings } = parseLatexLog('Output written on main.pdf (1 page).\n', 'main.tex')
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })
})