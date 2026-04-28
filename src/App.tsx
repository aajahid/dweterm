import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

const AI_PREFIX = "ai:";

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

function stripAiPrefix(input: string) {
  const trimmed = input.trim();
  return trimmed.toLowerCase().startsWith(AI_PREFIX)
    ? trimmed.slice(AI_PREFIX.length).trim()
    : trimmed;
}

function looksLikeShellCommand(input: string) {
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

function looksLikeNaturalLanguage(input: string) {
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

type BlockStatus = "running" | "success" | "error";

type CommandResult = {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
  durationMs: number;
};

type CommandBlock = {
  id: string;
  kind: "command";
  input: string;
  status: BlockStatus;
  result?: CommandResult;
  error?: string;
};

type AiBlock = {
  id: string;
  kind: "ai";
  input: string;
  status: BlockStatus;
  response?: string;
  error?: string;
};

type ConsoleBlock = CommandBlock | AiBlock;

function createBlockId() {
  return crypto.randomUUID();
}

function isCommandBlock(block: ConsoleBlock): block is CommandBlock {
  return block.kind === "command";
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(2)}s`;
}

function updateBlock(blocks: ConsoleBlock[], nextBlock: ConsoleBlock) {
  return blocks.map((block) => (block.id === nextBlock.id ? nextBlock : block));
}

function OutputSection({ label, value, tone }: { label: string; value: string; tone?: "error" }) {
  if (!value.trim()) {
    return null;
  }

  return (
    <section className={`output-section ${tone === "error" ? "output-section-error" : ""}`}>
      <p>{label}</p>
      <pre>{value}</pre>
    </section>
  );
}

function ConsoleBlockView({ block }: { block: ConsoleBlock }) {
  const isCommand = isCommandBlock(block);
  const title = isCommand ? "Command" : "AI";

  return (
    <article className={`console-block console-block-${block.kind}`}>
      <header className="block-header">
        <div>
          <span className="block-kind">{title}</span>
          <pre className="block-input">{block.input}</pre>
        </div>
        <span className={`block-status block-status-${block.status}`}>{block.status}</span>
      </header>

      {block.status === "running" && (
        <p className="block-loading">{isCommand ? "Running PowerShell command..." : "Thinking..."}</p>
      )}

      {isCommand && block.result && (
        <div className="block-body">
          <div className="command-meta">
            <span>exit {block.result.exitCode}</span>
            <span>{formatDuration(block.result.durationMs)}</span>
            <span>{block.result.cwd}</span>
          </div>
          <OutputSection label="stdout" value={block.result.stdout} />
          <OutputSection label="stderr" value={block.result.stderr} tone="error" />
          {!block.result.stdout.trim() && !block.result.stderr.trim() && (
            <p className="empty-output">Command completed with no output.</p>
          )}
        </div>
      )}

      {!isCommand && block.response && (
        <div className="block-body">
          <pre className="ai-response">{block.response}</pre>
        </div>
      )}

      {block.error && (
        <div className="block-body">
          <OutputSection label="error" value={block.error} tone="error" />
        </div>
      )}
    </article>
  );
}

function App() {
  const historyRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<ConsoleBlock[]>([]);
  const [input, setInput] = useState("");
  const [currentCwd, setCurrentCwd] = useState("Workspace");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    historyRef.current?.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [blocks]);

  const runAiPrompt = async (rawInput: string) => {
    const prompt = stripAiPrefix(rawInput);
    const block: AiBlock = {
      id: createBlockId(),
      kind: "ai",
      input: rawInput,
      status: "running",
    };

    setBlocks((currentBlocks) => [...currentBlocks, block]);

    try {
      const response = await invoke<string>("ask_local_llm", { prompt });
      setBlocks((currentBlocks) =>
        updateBlock(currentBlocks, {
          ...block,
          status: "success",
          response,
        }),
      );
    } catch (error) {
      setBlocks((currentBlocks) =>
        updateBlock(currentBlocks, {
          ...block,
          status: "error",
          error: String(error),
        }),
      );
    }
  };

  const runCommand = async (command: string) => {
    const block: CommandBlock = {
      id: createBlockId(),
      kind: "command",
      input: command,
      status: "running",
    };

    setBlocks((currentBlocks) => [...currentBlocks, block]);

    try {
      const result = await invoke<CommandResult>("run_shell_command", { command });
      setCurrentCwd(result.cwd);
      setBlocks((currentBlocks) =>
        updateBlock(currentBlocks, {
          ...block,
          status: result.exitCode === 0 ? "success" : "error",
          result,
        }),
      );
    } catch (error) {
      setBlocks((currentBlocks) =>
        updateBlock(currentBlocks, {
          ...block,
          status: "error",
          error: String(error),
        }),
      );
    }
  };

  const submitInput = async () => {
    const submittedInput = input.trim();

    if (!submittedInput || isBusy) {
      return;
    }

    setInput("");
    setIsBusy(true);

    try {
      if (looksLikeNaturalLanguage(submittedInput)) {
        await runAiPrompt(submittedInput);
      } else {
        await runCommand(submittedInput);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitInput();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitInput();
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">DweTerm</p>
          <h1>AI command workspace</h1>
        </div>
        <span className="status-pill">{currentCwd}</span>
      </header>

      <section className="workspace-panel" aria-label="DweTerm command workspace">
        <div ref={historyRef} className="block-history">
          {blocks.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">Start with a command or a question.</p>
              <p>
                Run PowerShell commands as structured blocks, or ask in natural language. Use{" "}
                <code>ai:</code> to force an AI response.
              </p>
            </div>
          ) : (
            blocks.map((block) => <ConsoleBlockView key={block.id} block={block} />)
          )}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <label htmlFor="command-input">Command or question</label>
          <div className="composer-input-row">
            <textarea
              id="command-input"
              value={input}
              placeholder="Get-ChildItem or ai: explain Get-ChildItem"
              rows={3}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={isBusy}
            />
            <button type="submit" disabled={isBusy || !input.trim()}>
              {isBusy ? "Running" : "Run"}
            </button>
          </div>
          <p className="composer-hint">Enter submits. Shift+Enter adds a new line.</p>
        </form>
      </section>
    </main>
  );
}

export default App;
