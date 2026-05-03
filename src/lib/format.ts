import type { ShellInfo } from "./types";

export function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(2)}s`;
}

export function formatPromptPath(shell: ShellInfo | null | undefined): string {
  if (!shell) return "~";
  const cwd = shell.cwd;
  const sep = shell.pathSeparator || "/";
  if (shell.homeDir && cwd.toLowerCase().startsWith(shell.homeDir.toLowerCase())) {
    const tail = cwd.slice(shell.homeDir.length).replace(/^[\\/]/, "");
    return tail ? `~${sep}${tail}` : "~";
  }
  return cwd;
}

export function formatShortShellLabel(shell: ShellInfo | null | undefined) {
  if (!shell) return "shell";
  const trimmed = shell.shellVersion?.trim();
  if (!trimmed || trimmed === "unknown") {
    return shell.shellName;
  }
  return `${shell.shellName} ${trimmed}`;
}

export function formatAppVersion(shell: ShellInfo | null | undefined) {
  return shell?.appVersion ?? "v0.0.0";
}
