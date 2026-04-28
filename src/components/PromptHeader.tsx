import { ShellInfo } from "../lib/types";
import { formatAppVersion, formatPromptPath } from "../lib/format";

type PromptHeaderProps = {
  shell: ShellInfo | null;
  durationMs?: number;
};

export function PromptHeader({ shell, durationMs }: PromptHeaderProps) {
  const version = formatAppVersion(shell);
  const path = formatPromptPath(shell);
  const branch = shell?.git?.branch ?? null;
  const dirty = shell?.git?.dirty ?? 0;
  const ahead = shell?.git?.ahead ?? 0;
  const behind = shell?.git?.behind ?? 0;
  const formattedDuration =
    typeof durationMs === "number"
      ? durationMs < 1000
        ? `${(durationMs / 1000).toFixed(3)}s`
        : `${(durationMs / 1000).toFixed(2)}s`
      : null;

  return (
    <div className="prompt-header" aria-hidden="false">
      <span className="prompt-version">{version}</span>
      <span className="prompt-path">{path}</span>
      {branch && (
        <span className="prompt-git">
          <span className="prompt-git-label">git:</span>
          <span className="prompt-git-paren">(</span>
          <span className="prompt-git-branch">{branch}</span>
          <span className="prompt-git-paren">)</span>
        </span>
      )}
      {branch && <span className="prompt-dirty">{dirty}</span>}
      {branch && <span className="prompt-dot">•</span>}
      {branch && (
        <span className="prompt-ab">
          +{ahead} -{behind}
        </span>
      )}
      {formattedDuration && (
        <span className="prompt-duration">({formattedDuration})</span>
      )}
    </div>
  );
}
