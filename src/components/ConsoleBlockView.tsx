import { useEffect, useState } from "react";
import { ConsoleBlock, isCommandBlock } from "../lib/types";
import { PromptHeader } from "./PromptHeader";

type ConsoleBlockViewProps = {
  block: ConsoleBlock;
};

export function ConsoleBlockView({ block }: ConsoleBlockViewProps) {
  const command = isCommandBlock(block);
  const isAiBlock = block.kind === "ai";
  const thinkingText = isAiBlock ? block.thinking : undefined;
  const shell = command ? block.result?.shellInfo ?? null : block.shellSnapshot;
  const durationMs = command
    ? block.result?.durationMs
    : block.durationMs;
  const [isThinkingCollapsed, setIsThinkingCollapsed] = useState(false);

  useEffect(() => {
    if (!isAiBlock || !thinkingText) {
      return;
    }
    if (block.status !== "running") {
      setIsThinkingCollapsed(true);
    }
  }, [block.status, thinkingText, isAiBlock]);

  return (
    <article
      className={`console-block console-block-${block.kind} console-block-${block.status}`}
    >
      <PromptHeader shell={shell} durationMs={durationMs} />
      <div className="block-command-line">
        {command ? (
          <span className="block-command-prompt">&gt;</span>
        ) : (
          <span className="block-ai-prompt">/agent</span>
        )}
        <pre className="block-command-text">{block.input}</pre>
      </div>

      {block.status === "running" && (
        <p className="block-loading">
          {command ? "Running command..." : "Streaming local Ollama response..."}
        </p>
      )}

      {command && block.result && (
        <div className="block-output">
          {block.result.stdout.trim() ? (
            <pre className="block-output-text">{block.result.stdout}</pre>
          ) : null}
          {block.result.stderr.trim() ? (
            <pre className="block-output-text block-output-error">{block.result.stderr}</pre>
          ) : null}
          {!block.result.stdout.trim() && !block.result.stderr.trim() && (
            <p className="block-empty">Command completed with no output.</p>
          )}
          {block.status === "error" && block.result.exitCode !== 0 && (
            <p className="block-exit-line">
              process exited with code {block.result.exitCode}
            </p>
          )}
        </div>
      )}

      {!command && (block.thinking || block.response) && (
        <div className="block-output">
          {block.thinking ? (
            <div className="block-ai-thinking">
              <button
                type="button"
                className="block-ai-thinking-toggle"
                onClick={() => setIsThinkingCollapsed((current) => !current)}
                aria-expanded={!isThinkingCollapsed}
                aria-label={
                  isThinkingCollapsed ? "Expand thinking block" : "Collapse thinking block"
                }
              >
                <span
                  className={`block-ai-thinking-icon ${
                    isThinkingCollapsed ? "is-collapsed" : ""
                  }`}
                  aria-hidden="true"
                >
                  ▼
                </span>
                <span className="block-ai-thinking-label">thinking</span>
              </button>
              {!isThinkingCollapsed && (
                <pre className="block-output-text block-output-ai-thinking">
                  {block.thinking}
                </pre>
              )}
            </div>
          ) : null}
          {block.response ? (
            <div className="block-ai-answer">
              <p className="block-ai-answer-label">response</p>
              <pre className="block-output-text block-output-ai">{block.response}</pre>
            </div>
          ) : null}
        </div>
      )}

      {block.error && (
        <div className="block-output">
          <pre className="block-output-text block-output-error">{block.error}</pre>
        </div>
      )}
    </article>
  );
}
