import { DEFAULT_DOCUMENT, DEFAULT_PROJECT_NAME } from './demo'
import type { ProjectDocument } from './types'

/** Sample documents offered through the project switcher. */
export const SAMPLE_PROJECTS: readonly ProjectDocument[] = [
  {
    id: 'sample-basic',
    name: 'Sample: Basics',
    entryFile: 'main.tex',
    source: DEFAULT_DOCUMENT,
    updatedAt: 0,
  },
  {
    id: 'sample-math',
    name: 'Sample: Mathematics',
    entryFile: 'main.tex',
    source: String.raw`\documentclass{article}
\usepackage{amsmath,amsthm}
\newtheorem{theorem}{Theorem}
\begin{document}
\begin{theorem}[Fundamental Theorem of Calculus]
If $f$ is continuous on $[a,b]$, then
\[
  \int_a^b f(x)\,dx = F(b) - F(a)
\]
where $F$ is an antiderivative of $f$.
\end{theorem}
\begin{proof}
Let $F(x) = \int_a^x f(t)\,dt$. Then $F'(x) = f(x)$ by the
mean value theorem.
\end{proof}
\end{document}
`,
    updatedAt: 0,
  },
  {
    id: 'sample-fontspec',
    name: 'Sample: Fonts (XeLaTeX)',
    entryFile: 'main.tex',
    source: String.raw`\documentclass{article}
\usepackage{fontspec}
\setmainfont{Latin Modern Roman}
\setsansfont{TeX Gyre Heros}

\begin{document}
\section{Unicode text with XeTeX}
Xe\LaTeX{} renders Unicode directly: Übermäßig, naïve, aβilfrei,
“curly quotes” --- no ASCII escapes needed.

\textsf{The sans font is pulled from the on-demand TeX Live
endpoint on first compile.}
\end{document}
`,
    updatedAt: 0,
  },
]

export function createNewDocument(id: string): ProjectDocument {
  return {
    id,
    name: DEFAULT_PROJECT_NAME,
    entryFile: 'main.tex',
    source: DEFAULT_DOCUMENT,
    updatedAt: Date.now(),
  }
}