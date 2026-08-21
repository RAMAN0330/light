type Props = {
  current: string;
  onNavigateToWorkspace: () => void;
};

export function WorkspaceBreadcrumb({ current, onNavigateToWorkspace }: Props) {
  return (
    <nav className="projects-breadcrumb workspace-breadcrumb" aria-label="Breadcrumb">
      <button type="button" onClick={onNavigateToWorkspace}>Workspace</button>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{current}</span>
    </nav>
  );
}
