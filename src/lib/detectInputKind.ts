export const AI_PREFIX = "ai:";

const shellCommandStarters = new Set([
  "cat",
  "cd",
  "clear",
  "cls",
  "code",
  "copy",
  "cp",
  "cargo",
  "del",
  "dir",
  "docker",
  "docker-compose",
  "echo",
  "exit",
  "git",
  "grep",
  "ls",
  "mkdir",
  "move",
  "mv",
  "node",
  "npm",
  "ollama",
  "pnpm",
  "powershell",
  "pwd",
  "py",
  "python",
  "rm",
  "rmdir",
  "rustup",
  "tauri",
  "type",
  "where",
  "winget",
  "yarn",
]);

const powershellVerbStarters = [
  "add-",
  "clear-",
  "copy-",
  "get-",
  "move-",
  "new-",
  "remove-",
  "select-",
  "set-",
  "start-",
  "stop-",
  "write-",
];

const naturalLanguageStarters = [
  "can you",
  "could you",
  "explain",
  "help me",
  "how ",
  "summarize",
  "tell me",
  "what ",
  "when ",
  "where ",
  "which ",
  "who ",
  "why ",
];

const naturalLanguageTerms = [
  "difference",
  "explain",
  "help",
  "meaning",
  "please",
  "reason",
  "summarize",
];

export function stripAiPrefix(input: string) {
  const trimmed = input.trim();
  return trimmed.toLowerCase().startsWith(AI_PREFIX)
    ? trimmed.slice(AI_PREFIX.length).trim()
    : trimmed;
}

export function looksLikeShellCommand(input: string) {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  const firstToken = lower.split(/\s+/, 1)[0] ?? "";

  return (
    shellCommandStarters.has(firstToken) ||
    powershellVerbStarters.some((starter) => firstToken.startsWith(starter)) ||
    /^[.$]?\w+\s*=/.test(trimmed) ||
    /^[.~]?[\\/]/.test(trimmed) ||
    /^\.{1,2}[\\/]/.test(trimmed) ||
    /^[&|<>]/.test(trimmed) ||
    /(?:&&|\|\||[|;<>])/.test(trimmed) ||
    /^\S+\.(?:exe|ps1|bat|cmd)(?:\s|$)/i.test(trimmed) ||
    /^\S+\s+-{1,2}\S+/.test(trimmed)
  );
}

export function looksLikeNaturalLanguage(input: string) {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return false;
  }

  if (lower.startsWith(AI_PREFIX)) {
    return stripAiPrefix(trimmed).length > 0;
  }

  if (looksLikeShellCommand(trimmed)) {
    return false;
  }

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const startsNaturally = naturalLanguageStarters.some((starter) => lower.startsWith(starter));
  const containsNaturalTerm = naturalLanguageTerms.some((term) => lower.includes(term));

  return (
    trimmed.endsWith("?") ||
    startsNaturally ||
    (wordCount >= 4 && containsNaturalTerm) ||
    (wordCount >= 5 && /[.?!]$/.test(trimmed))
  );
}
