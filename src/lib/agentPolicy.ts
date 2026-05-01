import { getShellProfile, type ShellKey } from "./shells";
import { AgentAction, AgentRisk } from "./types";

type PolicyResult = {
  action: AgentAction;
  denied: boolean;
  denialReason?: string;
};

function classifyRisk(command: string, shellKey: ShellKey | null | undefined): AgentRisk {
  const profile = getShellProfile(shellKey);
  if (profile.dangerousPatterns.some((pattern) => pattern.test(command))) {
    return "dangerous";
  }
  if (profile.cautionPatterns.some((pattern) => pattern.test(command))) {
    return "caution";
  }
  return "safe";
}

export function applyPolicy(
  action: AgentAction,
  shellKey: ShellKey | null | undefined,
): PolicyResult {
  const policyRisk = classifyRisk(action.command, shellKey);
  const mergedRisk: AgentRisk =
    action.risk === "dangerous" || policyRisk === "dangerous"
      ? "dangerous"
      : action.risk === "caution" || policyRisk === "caution"
        ? "caution"
        : "safe";
  const requiresConfirmation = action.requiresConfirmation || mergedRisk !== "safe";

  const denied = false;

  return {
    action: {
      ...action,
      risk: mergedRisk,
      requiresConfirmation,
    },
    denied,
    denialReason: denied ? "Command blocked by policy." : undefined,
  };
}
