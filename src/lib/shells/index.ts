import { bashProfile } from "./bash";
import { powershellProfile } from "./powershell";
import type { ShellKey, ShellProfile } from "./types";

export type { ShellKey, ShellProfile } from "./types";

const profiles: Record<ShellKey, ShellProfile> = {
  powershell: powershellProfile,
  bash: bashProfile,
};

export const DEFAULT_SHELL_KEY: ShellKey = "powershell";

export function isShellKey(value: unknown): value is ShellKey {
  return value === "powershell" || value === "bash";
}

export function normalizeShellKey(value: unknown): ShellKey {
  return isShellKey(value) ? value : DEFAULT_SHELL_KEY;
}

export function getShellProfile(key: ShellKey | null | undefined): ShellProfile {
  if (!key) {
    return profiles[DEFAULT_SHELL_KEY];
  }
  return profiles[key] ?? profiles[DEFAULT_SHELL_KEY];
}
