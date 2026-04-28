import { ShellInfo } from "../lib/types";
import { formatPromptPath, formatShortShellLabel } from "../lib/format";

type StatusBarProps = {
  shell: ShellInfo | null;
};

export function StatusBar({ shell }: StatusBarProps) {
  const shellLabel = formatShortShellLabel(shell);
  const path = formatPromptPath(shell);
  const branch = shell?.git?.branch ?? null;
  const dirty = shell?.git?.dirty ?? 0;

  return (
    <div className="status-bar" role="status" aria-label="Current shell context">
      <span className="status-chip">
        <SparkIcon />
        <span>{shellLabel}</span>
      </span>
      <span className="status-chip" title={shell?.cwd ?? ""}>
        <FolderIcon />
        <span>{path}</span>
      </span>
      {branch && (
        <span className="status-chip" title={`branch ${branch}`}>
          <BranchIcon />
          <span>{branch}</span>
        </span>
      )}
      <span
        className={`status-chip ${dirty > 0 ? "status-chip-dirty" : ""}`}
        title={dirty > 0 ? `${dirty} change(s)` : "clean working tree"}
      >
        <PlusMinusIcon />
        <span>± {dirty}</span>
      </span>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M2 5a1 1 0 0 1 1-1h3l1.4 1.4H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <circle cx="4" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="12" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <circle cx="4" cy="12" r="1.6" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path
        d="M4 5.6V12M4 9c0-2.6 1.6-5 8-5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  );
}

function PlusMinusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M3 5h4M5 3v4M9 11h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
