import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

import { TopBar } from "./components/TopBar";
import { StatusBar } from "./components/StatusBar";
import { ConsoleBlockView } from "./components/ConsoleBlockView";
import { Composer } from "./components/Composer";
import { EmptyState } from "./components/EmptyState";

import {
  AI_PREFIX,
  looksLikeNaturalLanguage,
  stripAiPrefix,
} from "./lib/detectInputKind";
import {
  AiBlock,
  CommandBlock,
  CommandResult,
  ConsoleBlock,
  ShellInfo,
} from "./lib/types";

function createBlockId() {
  return crypto.randomUUID();
}

function updateBlock(blocks: ConsoleBlock[], nextBlock: ConsoleBlock) {
  return blocks.map((block) => (block.id === nextBlock.id ? nextBlock : block));
}

function App() {
  const historyRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<ConsoleBlock[]>([]);
  const [shellInfo, setShellInfo] = useState<ShellInfo | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const info = await invoke<ShellInfo>("get_shell_info");
        setShellInfo(info);
      } catch {
        setShellInfo(null);
      }
    })();
  }, []);

  useEffect(() => {
    historyRef.current?.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [blocks]);

  const submittedHistory = useMemo(
    () => blocks.map((block) => block.input),
    [blocks],
  );

  const runAiPrompt = async (rawInput: string) => {
    const prompt = stripAiPrefix(rawInput);
    const block: AiBlock = {
      id: createBlockId(),
      kind: "ai",
      input: rawInput,
      status: "running",
      startedAt: Date.now(),
      shellSnapshot: shellInfo,
    };

    setBlocks((current) => [...current, block]);
    const start = performance.now();

    try {
      const response = await invoke<string>("ask_local_llm", { prompt });
      const durationMs = Math.round(performance.now() - start);
      setBlocks((current) =>
        updateBlock(current, {
          ...block,
          status: "success",
          response,
          durationMs,
        }),
      );
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      setBlocks((current) =>
        updateBlock(current, {
          ...block,
          status: "error",
          error: String(error),
          durationMs,
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
      startedAt: Date.now(),
    };

    setBlocks((current) => [...current, block]);

    try {
      const result = await invoke<CommandResult>("run_shell_command", { command });
      setShellInfo(result.shellInfo);
      setBlocks((current) =>
        updateBlock(current, {
          ...block,
          status: result.exitCode === 0 ? "success" : "error",
          result,
        }),
      );
    } catch (error) {
      setBlocks((current) =>
        updateBlock(current, {
          ...block,
          status: "error",
          error: String(error),
        }),
      );
    }
  };

  const handleSubmit = async (
    rawInput: string,
    options: { forceAi: boolean },
  ) => {
    if (isBusy) return;
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    setIsBusy(true);
    try {
      const forced = options.forceAi
        ? trimmed.toLowerCase().startsWith(AI_PREFIX)
          ? trimmed
          : `${AI_PREFIX} ${trimmed}`
        : trimmed;

      if (options.forceAi || looksLikeNaturalLanguage(forced)) {
        await runAiPrompt(forced);
      } else {
        await runCommand(forced);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleClear = () => {
    setBlocks([]);
  };

  return (
    <div className="app-root">
      <TopBar />
      <main className="terminal-surface">
        <section
          className="block-history"
          ref={historyRef}
          aria-label="DweTerm command history"
        >
          {blocks.length === 0 ? (
            <EmptyState cwd={shellInfo?.cwd ?? "Workspace"} />
          ) : (
            blocks.map((block) => (
              <ConsoleBlockView key={block.id} block={block} />
            ))
          )}
        </section>

        <div className="composer-shell">
          <StatusBar shell={shellInfo} />
          <Composer
            history={submittedHistory}
            isBusy={isBusy}
            onSubmit={(value, options) => void handleSubmit(value, options)}
          />
          {blocks.length > 0 && (
            <button
              type="button"
              className="clear-history-button"
              onClick={handleClear}
              title="Clear blocks (does not affect shell)"
            >
              clear blocks
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
