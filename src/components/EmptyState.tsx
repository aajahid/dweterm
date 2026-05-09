type EmptyStateProps = {
  cwd: string;
};

export function EmptyState({ cwd }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-grid">
        <div className="empty-card">
          <span className="empty-card-eyebrow">Run shell</span>
          <h3>Use PowerShell as usual</h3>
          <p>
            Try <code>Get-ChildItem</code>, <code>git status</code>, <code>node -v</code>.
          </p>
        </div>
        <div className="empty-card">
          <span className="empty-card-eyebrow">Ask AI</span>
          <h3>Start a question</h3>
          <p>
            Type <code>ai: explain Get-Process</code>, or press
            <kbd>ctrl</kbd>+<kbd>shift</kbd>+<kbd>↵</kbd>.
          </p>
        </div>
        <div className="empty-card">
          <span className="empty-card-eyebrow">Workspace</span>
          <h3>{cwd}</h3>
          <p>The session inherits this directory and tracks <code>cd</code> moves.</p>
        </div>
      </div>
    </div>
  );
}
