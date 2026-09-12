import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { AppErrorBoundary } from './app/AppErrorBoundary'
import { BrowserSupportGate } from './app/BrowserSupportGate'
import { RootLayout } from './app/RootLayout'
import { useCompiler } from './compiler/useCompiler'
import type { LatexProject } from './compiler/types'
import { CodeMirrorEditor } from './editor/CodeMirrorEditor'
import type { CodeMirrorEditorHandle } from './editor/CodeMirrorEditor'
import { PdfPlaceholder } from './pdf/PdfPlaceholder'
import { PdfViewer } from './pdf/PdfViewer'
import { createNewDocument, SAMPLE_PROJECTS } from './projects/samples'
import { DEFAULT_DOCUMENT } from './projects/demo'
import { createProjectRepository } from './projects/projectRepositoryFactory'
import type { ProjectDocument } from './projects/types'
import { SettingsProvider } from './settings/SettingsProvider'
import { useSettings } from './settings/settings'
import { useDebouncedCallback } from './hooks/useDebouncedCallback'

const ENTRY_FILE = 'main.tex'
const AUTOSAVE_DELAY_MS = 750

function Workspace() {
  const settings = useSettings()
  const repositoryRef = useRef(createProjectRepository())
  const [documentSource, setDocumentSource] = useState(DEFAULT_DOCUMENT)
  const [activeProject, setActiveProject] = useState<ProjectDocument | null>(null)
  const [projects, setProjects] = useState<ProjectDocument[]>([])
  const editorRef = useRef<CodeMirrorEditorHandle | null>(null)
  const latestProjectRef = useRef<ProjectDocument | null>(null)
  // Projects removed this session must never be resurrected by a stale save.
  const deletedIdsRef = useRef<Set<string>>(new Set())

  const makeProject = useCallback((): LatexProject => {
    const active = activeProject ?? latestProjectRef.current
    return {
      id: active?.id ?? 'local',
      name: active?.name ?? 'Untitled Project',
      entryFile: ENTRY_FILE,
      files: [{ path: ENTRY_FILE, type: 'text', content: documentSource }],
    }
  }, [activeProject, documentSource])

  const compiler = useCompiler(makeProject)
  const compilerRef = useRef(compiler)

  // Keep the test-seam views of the compiler fresh after every commit.
  useEffect(() => {
    compilerRef.current = compiler
  })

  const saveActiveProject = useCallback(async (): Promise<void> => {
    const latest = latestProjectRef.current
    // A stale snapshot for a project that was deleted this session must never
    // be written back to the repository (autosave race on delete).
    if (!latest || deletedIdsRef.current.has(latest.id)) return
    await repositoryRef.current.save(latest)
  }, [])

  // Debounced autosave: idempotent, saves whatever the latest snapshot is.
  const { invoke: autosave, cancel: cancelAutosave } = useDebouncedCallback(() => {
    void saveActiveProject().then(() => {
      const latest = latestProjectRef.current
      if (!latest || deletedIdsRef.current.has(latest.id)) return
      setProjects((previous) => {
        const next = previous.filter((project) => project.id !== latest.id)
        return [{ ...latest }, ...next]
      })
    })
  }, AUTOSAVE_DELAY_MS)

  // Initial load: restore the most recently edited user project, seeding the
  // repository with samples on the very first run.
  useEffect(() => {
    const repository = repositoryRef.current
    let cancelled = false
    void repository.list().then(async (saved) => {
      if (cancelled) return
      if (saved.length === 0) {
        const seeded = SAMPLE_PROJECTS.map((sample) => ({ ...sample, updatedAt: Date.now() }))
        for (const project of seeded) {
          await repository.save(project)
        }
        setProjects(seeded)
        setActiveProject(seeded[0] ?? null)
        setDocumentSource(seeded[0]?.source ?? '')
      } else {
        const userProjects = saved.filter((project) => !project.id.startsWith('sample-'))
        const latest = userProjects[0] ?? saved[0]
        setProjects(saved)
        setActiveProject(latest ?? null)
        setDocumentSource(latest?.source ?? '')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Important edge case (spec): a stale snapshot must never overwrite a newer
  // one. The latest snapshot is mirrored into a ref after every commit, so a
  // delayed save always lands the freshest source.
  useEffect(() => {
    if (activeProject) {
      latestProjectRef.current = { ...activeProject, source: documentSource, updatedAt: Date.now() }
    }
  })

  const handleSourceChange = useCallback(
    (source: string) => {
      setDocumentSource(source)
      autosave()
    },
    [autosave],
  )

  // Keep the latest change handler available to the mount-only test seam.
  const handleSourceChangeRef = useRef(handleSourceChange)
  useEffect(() => {
    handleSourceChangeRef.current = handleSourceChange
  })

  // Test seam: expose compileProject, status, and source access to Playwright
  // e2e. getSource/setSource drive the same autosave path as typing.
  useEffect(() => {
    const api = {
      compileProject: (project: LatexProject) => compilerRef.current.compileProject(project),
      getStatus: () => compilerRef.current.status,
      getSource: () => latestProjectRef.current?.source ?? '',
      setSource: (source: string) => handleSourceChangeRef.current(source),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__latex = api
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { delete (window as any).__latex }
  }, [])

  const handleSelectProject = useCallback(
    (id: string) => {
      void saveActiveProject()
      const project = projects.find((candidate) => candidate.id === id)
      if (!project) return
      setActiveProject(project)
      setDocumentSource(project.source)
      latestProjectRef.current = project
    },
    [projects, saveActiveProject],
  )

  const handleNewProject = useCallback(() => {
    void saveActiveProject()
    const id = `project-${(crypto.randomUUID?.() ?? String(Date.now()))}`
    const fresh = createNewDocument(id)
    void repositoryRef.current.save(fresh)
    setProjects((previous) => [fresh, ...previous])
    setActiveProject(fresh)
    setDocumentSource(fresh.source)
    latestProjectRef.current = fresh
  }, [saveActiveProject])

  const handleDeleteProject = useCallback((): void => {
    const target = activeProject
    if (!target) return
    if (!window.confirm(`Delete "${target.name}"? This cannot be undone.`)) return

    // Clear any pending autosave and mark the id as deleted so an in-flight
    // save can't write it back or re-insert it into the list later.
    cancelAutosave()
    deletedIdsRef.current.add(target.id)
    latestProjectRef.current = null

    const remaining = projects.filter((candidate) => candidate.id !== target.id)
    setProjects(remaining)
    void repositoryRef.current.delete(target.id)

    // The deleted project's PDF must vanish from the preview and download.
    compiler.reset()
    const fallback = remaining[0] ?? null
    if (fallback) {
      setActiveProject(fallback)
      setDocumentSource(fallback.source)
      latestProjectRef.current = { ...fallback, updatedAt: Date.now() }
    } else {
      setActiveProject(null)
      setDocumentSource('')
    }
  }, [activeProject, projects, cancelAutosave, compiler])

  // Mirror the editor theme onto the surrounding chrome.
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  // Ctrl/Cmd + Enter compiles from anywhere in the app.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key === 'Enter'
      if (!isShortcut) return
      const serverState = compilerRef.current.status.state
      if (serverState === 'initializing' || serverState === 'compiling') return
      event.preventDefault()
      void compilerRef.current.compile()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleCompile = () => {
    void compiler.compile()
  }

  const handleDownload = () => {
    compiler.download(activeProject?.name ?? 'compiled')
  }

  const compileDisabled =
    !activeProject || compiler.status.state === 'initializing' || compiler.status.state === 'compiling'
  const deleteDisabled =
    !activeProject ||
    compiler.status.state === 'initializing' ||
    compiler.status.state === 'compiling'
  const projectName = activeProject?.name ?? 'Untitled Project'
  const projectOptions = projects.map((project) => ({ id: project.id, name: project.name }))

  return (
    <RootLayout
      projectName={projectName}
      projects={projectOptions}
      activeProjectId={activeProject?.id}
      onSelectProject={handleSelectProject}
      onNewProject={handleNewProject}
      onDeleteProject={handleDeleteProject}
      deleteDisabled={deleteDisabled}
      compileDisabled={compileDisabled}
      downloadDisabled={!compiler.pdfBytes}
      onCompile={handleCompile}
      onDownload={handleDownload}
      status={compiler.status.message}
      editor={
        <CodeMirrorEditor
          ref={editorRef}
          value={documentSource}
          onChange={handleSourceChange}
          theme={settings.theme}
          fontSize={settings.fontSize}
          ariaLabel="LaTeX source editor"
        />
      }
      preview={
        compiler.pdfBytes ? (
          <PdfViewer key={compiler.compileRevision} pdfBytes={compiler.pdfBytes} />
        ) : (
          <PdfPlaceholder status={compiler.status} />
        )
      }
    />
  )
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserSupportGate>
        <SettingsProvider>
          <Workspace />
        </SettingsProvider>
      </BrowserSupportGate>
    </AppErrorBoundary>
  )
}