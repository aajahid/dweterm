import { AgentAction, AgentRisk } from "./types";

type PolicyResult = {
  action: AgentAction;
  denied: boolean;
  denialReason?: string;
};

const dangerousPatterns = [
  /\brm\b/i,
  /\bremove-item\b/i,
  /\bdel\b/i,
  /\brmdir\b/i,
  /\bformat-volume\b/i,
  /\bformat\b/i,
  /\bshutdown\b/i,
  /\bstop-process\b/i,
  /\btaskkill\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\breg\s+(add|delete)\b/i,
];

const cautionPatterns = [
  /\bmove-item\b/i,
  /\bcopy-item\b/i,
  /\brename-item\b/i,
  /\bgit\s+(clean|checkout|restore)\b/i,
  /\bnew-item\b/i,
  /\bset-content\b/i,
  /\binvoke-webrequest\b/i,
  /\bcurl\b/i,
  /\bwinget\s+install\b/i,
];

function classifyRisk(command: string): AgentRisk {
  if (dangerousPatterns.some((pattern) => pattern.test(command))) {
    return "dangerous";
  }
  if (cautionPatterns.some((pattern) => pattern.test(command))) {
    return "caution";
  }
  return "safe";
}

export function applyPolicy(action: AgentAction): PolicyResult {
  const policyRisk = classifyRisk(action.command);
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
