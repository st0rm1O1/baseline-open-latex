# Browser LaTeX Editor

A fully client-side LaTeX editing and compilation environment. Documents compile
entirely inside your browser via WebAssembly, so nothing leaves your machine and
there is no server to run.

## Features

- LaTeX source editing powered by CodeMirror 6 (syntax highlighting for TeX,
  bracket matching, history, search)
- PDF compilation in a Web Worker using XeLaTeX for WebAssembly
  ([texlyre-busytex](https://github.com/Jelmerro/texlyre-busytex))
- Embedded PDF preview with zoom and page navigation
- Vector fonts via XeLaTeX + fontspec (Unicode and OpenType fonts)
- Local project persistence in IndexedDB: autosaved ~750 ms after you stop
  typing, with a project switcher and curated sample documents
- No compilation server: the basic TeX Live toolchain is bundled statically;
  extra packages and fonts are fetched on demand from a TeX Live endpoint and
  cached in the browser

## Development

```sh
npm install        # install dependencies
npm run dev        # dev server with HMR (http://localhost:5173/baseline-open-latex/)
npm run lint       # ESLint + TypeScript-aware rules
npm run typecheck  # TypeScript project references
npm run test       # Vitest tests
npm run build      # typecheck + production build to dist/
npm run preview    # preview production build
```

The WebAssembly engine and the bundled basic TeX Live layer live in
`public/busytex/` (committed to the repository). To re-fetch them from a
`TEXLYRE_ASSETS_ARCHIVE` cache or upstream:

```sh
npm run assets:fetch
```

### End-to-end gates

The compiler only runs inside a real browser (the engine relies on browser
storage caches), so production builds are verified with headless Chromium
gates that start `vite preview` automatically:

```sh
npm run build        # required first; the gates serve dist/
npm run e2e:compile  # default document compiles and a PDF canvas renders ink
npm run e2e:resume   # fontspec/resume fixture compiles via the on-demand endpoint
npm run e2e:persistence  # autosave survives a full reload (IndexedDB round-trip)
npm run e2e:download # a downloaded PDF saves non-empty bytes, not a 0-byte file
```

## Deployment

Deploy the contents of `dist/` to the root of GitHub Pages. The app is built
for the `/baseline-open-latex/` base path by default. When deploying elsewhere,
set the `VITE_BASE_PATH` environment variable (e.g.
`VITE_BASE_PATH=/editor/ npm run build`).

A GitHub Actions workflow (`.github/workflows/deploy.yml`) runs lint,
typecheck, unit tests, and the production build, then deploys to GitHub Pages
on push to the default branch.

## How it works

1. The TeX/LaTeX sources are sent to a Web Worker.
2. The worker drives a WASM build of TeX Live 2026 (XeLaTeX) using the bundled
   `texlive-basic` layer; packages and fonts outside that layer are fetched on
   demand from the TeX Live endpoint and cached by the engine in IndexedDB.
3. The produced PDF bytes are transferred back, rendered with PDF.js, and can be
   downloaded.
4. Your documents are saved to IndexedDB (falling back to in-memory storage
   with a warning if IndexedDB is unavailable, e.g. private browsing).

## License and attribution

GNU Affero General Public License v3.0 or later. See [LICENSE](./LICENSE).

This project uses the
[texlyre-busytex](https://github.com/Jelmerro/texlyre-busytex) engine, which is
also AGPL-3.0. The vendored engine assets include TeX Live's basic distribution
(fonts and macros, GUST Font License / LPPL as applicable) and, in the test
fixtures, the [Merriweather](https://github.com/SorkinType/Merriweather) font
(SIL Open Font License).