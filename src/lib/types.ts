import type { ShellKey } from "./shells";

export type GitInfo = {
  branch: string | null;
  dirty: number;
  ahead: number;
  behind: number;
};

export type ShellInfo = {
  appVersion: string;
  shellName: string;
  shellKey: ShellKey;
  shellVersion: string;
  pathSeparator: string;
  cwd: string;
  homeDir: string | null;
  git: GitInfo | null;
};

export type CommandResult = {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
  durationMs: number;
  shellInfo: ShellInfo;
};

export type BlockStatus = "running" | "success" | "error";

export type AgentRisk = "safe" | "caution" | "dangerous";

export type AgentMode = "command" | "clarify" | "explain";

export type AgentStepStatus =
  | "planned"
  | "awaiting_confirmation"
  | "executing"
  | "completed"
  | "blocked"
  | "failed";

export type AgentAction = {
  id: string;
  shell: ShellKey;
  command: string;
  cwd: string | null;
  risk: AgentRisk;
  requiresConfirmation: boolean;
  reason: string;
  status: AgentStepStatus;
  result?: CommandResult;
  error?: string;
};

export type AgentPlan = {
  mode: AgentMode;
  summary: string;
  commands: AgentAction[];
  validation: string[];
  questions: string[];
  explanation: string;
  rawJson?: string;
  parseError?: string;
};

export type AgentRunStatus =
  | "none"
  | "planned"
  | "running"
  | "awaiting_confirmation"
  | "completed"
  | "failed";

export type AgentRunState = {
  status: AgentRunStatus;
  currentStep: number;
  message?: string;
  plan?: AgentPlan;
};

export type CommandBlock = {
  id: string;
  kind: "command";
  input: string;
  status: BlockStatus;
  startedAt: number;
  result?: CommandResult;
  error?: string;
};

export type AiBlock = {
  id: string;
  kind: "ai";
  input: string;
  status: BlockStatus;
  startedAt: number;
  durationMs?: number;
  shellSnapshot: ShellInfo | null;
  thinking?: string;
  response?: string;
  isWritingCommand?: boolean;
  error?: string;
  agent?: AgentRunState;
};

export type ConsoleBlock = CommandBlock | AiBlock;

export function isCommandBlock(block: ConsoleBlock): block is CommandBlock {
  return block.kind === "command";
}
