export type GitInfo = {
  branch: string | null;
  dirty: number;
  ahead: number;
  behind: number;
};

export type ShellInfo = {
  appVersion: string;
  shellName: string;
  shellVersion: string;
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
  response?: string;
  error?: string;
};

export type ConsoleBlock = CommandBlock | AiBlock;

export function isCommandBlock(block: ConsoleBlock): block is CommandBlock {
  return block.kind === "command";
}
