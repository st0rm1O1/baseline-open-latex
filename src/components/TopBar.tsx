export interface ProjectOption {
  id: string
  name: string
}

export interface TopBarProps {
  projectName: string
  projects?: ProjectOption[]
  activeProjectId?: string
  onSelectProject?: (id: string) => void
  onNewProject?: () => void
  onDeleteProject?: () => void
  deleteDisabled?: boolean
  compileDisabled: boolean
  downloadDisabled: boolean
  onCompile: () => void
  onDownload: () => void
}

export function TopBar({
  projectName,
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  deleteDisabled,
  compileDisabled,
  downloadDisabled,
  onCompile,
  onDownload,
}: TopBarProps) {
  return (
    <header className="topbar" role="banner">
      <div className="topbar__brand">
        <span className="topbar__logo" aria-hidden="true">
          TeX
        </span>
        <span className="topbar__project-name" title={projectName}>
          {projects && projects.length > 0 ? (
            <select
              className="topbar__project-select"
              value={activeProjectId ?? ''}
              onChange={(event) => onSelectProject?.(event.target.value)}
              aria-label="Switch project"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          ) : (
            projectName
          )}
        </span>
      </div>
      <div className="topbar__actions">
        <button
          type="button"
          className="button"
          onClick={onNewProject}
          title="Create a new document"
        >
          New
        </button>
        <button
          type="button"
          className="button"
          onClick={onDeleteProject}
          disabled={deleteDisabled}
          title="Delete this project"
        >
          Delete
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={compileDisabled}
          onClick={onCompile}
          title="Compile LaTeX (Ctrl/Cmd + Enter)"
        >
          Compile
        </button>
        <button
          type="button"
          className="button"
          disabled={downloadDisabled}
          onClick={onDownload}
          title="Download the compiled PDF"
        >
          Download PDF
        </button>
        <button type="button" className="button" title="Settings">
          Settings
        </button>
      </div>
    </header>
  )
}