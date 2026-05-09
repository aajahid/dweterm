import { useEffect, useState } from "react";
import { ConsoleBlock, isCommandBlock } from "../lib/types";
import { PromptHeader } from "./PromptHeader";

type ConsoleBlockViewProps = {
  block: ConsoleBlock;
  onApproveAgentStep?: (blockId: string, stepId: string) => void;
  onRejectAgentStep?: (blockId: string, stepId: string) => void;
};

export function ConsoleBlockView({
  block,
  onApproveAgentStep,
  onRejectAgentStep,
}: ConsoleBlockViewProps) {
  const command = isCommandBlock(block);
  const isAiBlock = block.kind === "ai";
  const thinkingText = isAiBlock ? block.thinking : undefined;
  const responseText = isAiBlock ? block.response : undefined;
  const isWritingCommand = isAiBlock ? Boolean(block.isWritingCommand) : false;
  const shell = command ? block.result?.shellInfo ?? null : block.shellSnapshot;
  const durationMs = command
    ? block.result?.durationMs
    : block.durationMs;
  const [isThinkingCollapsed, setIsThinkingCollapsed] = useState(false);

  useEffect(() => {
    if (!isAiBlock || !thinkingText) {
      return;
    }
    if (responseText) {
      setIsThinkingCollapsed(true);
      return;
    }
    if (block.status !== "running") {
      setIsThinkingCollapsed(true);
    }
  }, [block.status, responseText, thinkingText, isAiBlock]);

  return (
    <article
      className={`console-block console-block-${block.kind} console-block-${block.status}`}
    >
      <PromptHeader shell={shell} durationMs={durationMs} />
      <div className="block-command-line">
        {command ? (
          <span className="block-command-prompt">&gt;</span>
        ) : (
          <span className="block-ai-prompt">ai:</span>
        )}
        <pre className="block-command-text">{block.input}</pre>
      </div>

      {block.status === "running" && (
        command ? (
          <p className="block-loading">Running command...</p>
        ) : isWritingCommand ? (
          <div className="block-loading block-loading-generating" role="status" aria-live="polite">
            <span className="loading-dots" aria-hidden="true">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </span>
            <span className="block-loading-text">Command is generating</span>
          </div>
        ) : (
          <p className="block-loading">Streaming local Ollama response...</p>
        )
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

          {block.agent?.plan ? (
            <div className="block-ai-plan">
              <p className="block-ai-answer-label">agent plan</p>
              <p className="block-ai-plan-summary">{block.agent.plan.summary}</p>
              <ul className="block-ai-plan-list">
                {block.agent.plan.commands.map((step) => (
                  <li key={step.id} className="block-ai-plan-step">
                    <div className="block-ai-plan-step-head">
                      <span className={`step-risk step-risk-${step.risk}`}>{step.risk}</span>
                      <span className={`step-status step-status-${step.status}`}>
                        {step.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <pre className="block-output-text block-ai-plan-command">{step.command}</pre>
                    <p className="block-ai-plan-reason">{step.reason}</p>
                    {step.error ? (
                      <p className="block-ai-plan-error">{step.error}</p>
                    ) : null}
                    {step.status === "awaiting_confirmation" ? (
                      <div className="block-ai-plan-actions">
                        <button
                          type="button"
                          className="step-action step-approve"
                          onClick={() => onApproveAgentStep?.(block.id, step.id)}
                        >
                          approve and run
                        </button>
                        <button
                          type="button"
                          className="step-action step-reject"
                          onClick={() => onRejectAgentStep?.(block.id, step.id)}
                        >
                          reject
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {block.agent.message ? (
                <p className="block-ai-plan-note">{block.agent.message}</p>
              ) : null}
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
