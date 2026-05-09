import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
  AgentPlan,
  CommandBlock,
  CommandResult,
  ConsoleBlock,
  ShellInfo,
} from "./lib/types";
import { parseAgentResponse } from "./lib/agentParser";
import { applyPolicy } from "./lib/agentPolicy";
import { DEFAULT_SHELL_KEY } from "./lib/shells";

function createBlockId() {
  return crypto.randomUUID();
}

function updateBlock(blocks: ConsoleBlock[], nextBlock: ConsoleBlock) {
  return blocks.map((block) => (block.id === nextBlock.id ? nextBlock : block));
}

type AiStreamChunk = {
  blockId: string;
  kind: "thinking" | "response";
  text: string;
};

const AGENT_JSON_OPEN = "<agent_json>";
const AGENT_JSON_CLOSE = "</agent_json>";

function extractStreamedAgentText(raw: string): string {
  const openIndex = raw.indexOf(AGENT_JSON_OPEN);
  if (openIndex === -1) {
    return raw;
  }

  const closeIndex = raw.indexOf(AGENT_JSON_CLOSE, openIndex + AGENT_JSON_OPEN.length);
  if (closeIndex === -1) {
    return "";
  }

  const beforeJson = raw.slice(0, openIndex);
  const afterJson = raw.slice(closeIndex + AGENT_JSON_CLOSE.length);
  return `${beforeJson}${afterJson}`.trim();
}

function isStreamingAgentJson(raw: string): boolean {
  const openIndex = raw.indexOf(AGENT_JSON_OPEN);
  if (openIndex === -1) {
    return false;
  }
  return raw.indexOf(AGENT_JSON_CLOSE, openIndex + AGENT_JSON_OPEN.length) === -1;
}

function App() {
  const historyRef = useRef<HTMLDivElement>(null);
  const blocksRef = useRef<ConsoleBlock[]>([]);
  const aiResponseStreamRef = useRef<Record<string, string>>({});
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
    let unlisten: (() => void) | null = null;

    void (async () => {
      unlisten = await listen<AiStreamChunk>(
        "dweterm://ai-stream-chunk",
        (event) => {
          const chunk = event.payload;
          if (!chunk?.blockId || !chunk.text) {
            return;
          }

          setBlocks((current) =>
            current.map((block) => {
              if (block.kind !== "ai" || block.id !== chunk.blockId) {
                return block;
              }

              if (chunk.kind === "thinking") {
                return {
                  ...block,
                  thinking: `${block.thinking ?? ""}${chunk.text}`,
                };
              }

              const rawResponse = `${
                aiResponseStreamRef.current[chunk.blockId] ?? ""
              }${chunk.text}`;
              aiResponseStreamRef.current[chunk.blockId] = rawResponse;

              return {
                ...block,
                response: extractStreamedAgentText(rawResponse),
                isWritingCommand: isStreamingAgentJson(rawResponse),
              };
            }),
          );
        },
      );
    })();

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

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

  const updateAiBlock = (blockId: string, updater: (block: AiBlock) => AiBlock) => {
    setBlocks((current) =>
      current.map((entry) =>
        entry.kind === "ai" && entry.id === blockId ? updater(entry) : entry,
      ),
    );
  };

  const initializeAgentState = (plan: AgentPlan): AgentPlan => {
    const shellKey = shellInfo?.shellKey ?? DEFAULT_SHELL_KEY;
    const commands = plan.commands.map((action) => {
      const policy = applyPolicy(action, shellKey);
      if (policy.denied) {
        return {
          ...policy.action,
          status: "blocked" as const,
          error: policy.denialReason,
        };
      }
      return policy.action;
    });
    return { ...plan, commands };
  };

  const runAgentStep = async (
    blockId: string,
    plan: AgentPlan,
    stepIndex: number,
  ): Promise<{ plan: AgentPlan; halted: boolean }> => {
    const action = plan.commands[stepIndex];
    if (!action) {
      return { plan, halted: true };
    }

    if (action.status === "blocked") {
      return {
        plan: {
          ...plan,
          commands: plan.commands.map((entry, index) =>
            index === stepIndex ? { ...entry, status: "blocked" } : entry,
          ),
        },
        halted: true,
      };
    }

    if (action.requiresConfirmation && action.status !== "executing") {
      const waitingPlan: AgentPlan = {
        ...plan,
        commands: plan.commands.map((entry, index) =>
          index === stepIndex
            ? { ...entry, status: "awaiting_confirmation" }
            : entry,
        ),
      };
      updateAiBlock(blockId, (block) => ({
        ...block,
        agent: {
          status: "awaiting_confirmation",
          currentStep: stepIndex,
          message: "Awaiting confirmation for a risky step.",
          plan: waitingPlan,
        },
      }));
      return { plan: waitingPlan, halted: true };
    }

    const executingPlan: AgentPlan = {
      ...plan,
      commands: plan.commands.map((entry, index) =>
        index === stepIndex ? { ...entry, status: "executing" } : entry,
      ),
    };
    updateAiBlock(blockId, (block) => ({
      ...block,
      agent: {
        status: "running",
        currentStep: stepIndex,
        plan: executingPlan,
      },
    }));

    try {
      const result = await runCommand(action.command);
      if (!result) {
        throw new Error("Command did not return a result.");
      }

      const nextPlan: AgentPlan = {
        ...executingPlan,
        commands: executingPlan.commands.map((entry, index) =>
          index === stepIndex
            ? {
                ...entry,
                status: result.exitCode === 0 ? "completed" : "failed",
                result,
                error:
                  result.exitCode === 0
                    ? undefined
                    : `Command exited with code ${result.exitCode}.`,
              }
            : entry,
        ),
      };

      const failed = result.exitCode !== 0;
      updateAiBlock(blockId, (block) => ({
        ...block,
        agent: {
          status: failed ? "failed" : "running",
          currentStep: stepIndex + (failed ? 0 : 1),
          message: failed ? "Agent execution stopped on failed command." : undefined,
          plan: nextPlan,
        },
      }));
      return { plan: nextPlan, halted: failed };
    } catch (error) {
      const failedPlan: AgentPlan = {
        ...executingPlan,
        commands: executingPlan.commands.map((entry, index) =>
          index === stepIndex
            ? {
                ...entry,
                status: "failed",
                error: String(error),
              }
            : entry,
        ),
      };
      updateAiBlock(blockId, (block) => ({
        ...block,
        agent: {
          status: "failed",
          currentStep: stepIndex,
          message: "Agent execution failed while running command.",
          plan: failedPlan,
        },
      }));
      return { plan: failedPlan, halted: true };
    }
  };

  const runAgentPlan = async (blockId: string, initialPlan: AgentPlan, startIndex = 0) => {
    let workingPlan = initialPlan;
    for (let index = startIndex; index < workingPlan.commands.length; index += 1) {
      const step = workingPlan.commands[index];
      if (!step) continue;
      if (step.status === "completed") continue;

      const { plan, halted } = await runAgentStep(blockId, workingPlan, index);
      workingPlan = plan;
      if (halted) return;
    }

    updateAiBlock(blockId, (block) => ({
      ...block,
      agent: {
        status: "completed",
        currentStep: workingPlan.commands.length,
        message: "Agent plan completed.",
        plan: workingPlan,
      },
    }));
  };

  const runAiPrompt = async (rawInput: string) => {
    const prompt = stripAiPrefix(rawInput);
    const block: AiBlock = {
      id: createBlockId(),
      kind: "ai",
      input: rawInput,
      status: "running",
      startedAt: Date.now(),
      shellSnapshot: shellInfo,
      isWritingCommand: false,
    };

    setBlocks((current) => [...current, block]);
    aiResponseStreamRef.current[block.id] = "";
    const start = performance.now();

    try {
      const response = await invoke<string>("ask_local_llm_stream", {
        prompt,
        blockId: block.id,
      });
      const durationMs = Math.round(performance.now() - start);
      const parsed = parseAgentResponse(response ?? "");
      const initializedPlan = parsed.plan ? initializeAgentState(parsed.plan) : null;
      setBlocks((current) =>
        current.map((entry) =>
          entry.kind === "ai" && entry.id === block.id
            ? {
                ...entry,
                status: "success",
                response: parsed.explanation || entry.response || "",
                isWritingCommand: false,
                durationMs,
                agent: initializedPlan
                  ? {
                      status: "planned",
                      currentStep: 0,
                      message: parsed.error,
                      plan: initializedPlan,
                    }
                  : parsed.error
                    ? {
                        status: "failed",
                        currentStep: 0,
                        message: parsed.error,
                      }
                    : undefined,
              }
            : entry,
        ),
      );
      delete aiResponseStreamRef.current[block.id];

      if (initializedPlan && initializedPlan.mode === "command") {
        await runAgentPlan(block.id, initializedPlan, 0);
      }
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      setBlocks((current) =>
        current.map((entry) =>
          entry.kind === "ai" && entry.id === block.id
            ? {
                ...entry,
                status: "error",
                error: String(error),
                isWritingCommand: false,
                durationMs,
              }
            : entry,
        ),
      );
      delete aiResponseStreamRef.current[block.id];
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
      return result;
    } catch (error) {
      setBlocks((current) =>
        updateBlock(current, {
          ...block,
          status: "error",
          error: String(error),
        }),
      );
      return null;
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

      const shellKey = shellInfo?.shellKey ?? DEFAULT_SHELL_KEY;
      if (options.forceAi || looksLikeNaturalLanguage(forced, shellKey)) {
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

  const handleApproveStep = async (blockId: string, stepId: string) => {
    const aiBlock = blocksRef.current.find(
      (entry): entry is AiBlock => entry.kind === "ai" && entry.id === blockId,
    );
    const plan = aiBlock?.agent?.plan;
    if (!plan) return;
    const stepIndex = plan.commands.findIndex((entry) => entry.id === stepId);
    if (stepIndex < 0) return;

    const approvedPlan: AgentPlan = {
      ...plan,
      commands: plan.commands.map((entry, index) =>
        index === stepIndex
          ? {
              ...entry,
              requiresConfirmation: false,
              status: "planned",
            }
          : entry,
      ),
    };

    updateAiBlock(blockId, (block) => ({
      ...block,
      agent: {
        status: "running",
        currentStep: stepIndex,
        plan: approvedPlan,
      },
    }));
    await runAgentPlan(blockId, approvedPlan, stepIndex);
  };

  const handleRejectStep = (blockId: string, stepId: string) => {
    updateAiBlock(blockId, (block) => {
      const plan = block.agent?.plan;
      if (!plan) return block;
      const nextPlan: AgentPlan = {
        ...plan,
        commands: plan.commands.map((entry) =>
          entry.id === stepId
            ? {
                ...entry,
                status: "blocked",
                error: "User rejected this step.",
              }
            : entry,
        ),
      };
      return {
        ...block,
        agent: {
          status: "failed",
          currentStep: plan.commands.findIndex((entry) => entry.id === stepId),
          message: "Agent step rejected by user.",
          plan: nextPlan,
        },
      };
    });
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
              <ConsoleBlockView
                key={block.id}
                block={block}
                onApproveAgentStep={(blockId, stepId) =>
                  void handleApproveStep(blockId, stepId)
                }
                onRejectAgentStep={handleRejectStep}
              />
            ))
          )}
        </section>

        <div
          className="composer-shell"
          onClick={(event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest("button")) return;
            const composerInput =
              document.querySelector<HTMLInputElement>(".composer-input");
            composerInput?.focus();
          }}
        >
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
