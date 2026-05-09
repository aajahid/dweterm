import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ComposerProps = {
  history: string[];
  isBusy: boolean;
  onSubmit: (input: string, options: { forceAi: boolean }) => void;
};

export function Composer({ history, isBusy, onSubmit }: ComposerProps) {
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isBusy) {
      inputRef.current?.focus();
    }
  }, [isBusy]);

  const ghost = useMemo(() => {
    if (!input) return "";
    const match = [...history]
      .reverse()
      .find((entry) => entry.startsWith(input) && entry !== input);
    return match ? match.slice(input.length) : "";
  }, [history, input]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;
    onSubmit(trimmed, { forceAi: false });
    setInput("");
    setHistoryIndex(null);
    setDraft("");
  };

  const acceptGhost = () => {
    if (!ghost) return false;
    setInput(input + ghost);
    setHistoryIndex(null);
    setDraft("");
    return true;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      if (event.ctrlKey && event.shiftKey) {
        event.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || isBusy) return;
        onSubmit(trimmed, { forceAi: true });
        setInput("");
        setHistoryIndex(null);
        setDraft("");
      }
      return;
    }

    if ((event.key === "ArrowRight" || event.key === "Tab") && ghost) {
      const cursorAtEnd =
        event.currentTarget.selectionStart === event.currentTarget.value.length;
      if (event.key === "Tab" || cursorAtEnd) {
        if (acceptGhost()) {
          event.preventDefault();
        }
      }
      return;
    }

    if (event.key === "ArrowUp") {
      if (history.length === 0) return;
      event.preventDefault();
      if (historyIndex === null) {
        setDraft(input);
        const nextIndex = history.length - 1;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      } else if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      if (historyIndex === null) return;
      event.preventDefault();
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setInput(draft);
      } else {
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      }
    }
  };

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div
        className="composer-row"
        onClick={(event) => {
          if (event.target !== inputRef.current) {
            inputRef.current?.focus();
          }
        }}
      >
        <span className="composer-prompt">&gt;</span>
        <div className="composer-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="composer-input"
            value={input}
            placeholder="run a command, or write a question for AI"
            onChange={(event) => {
              setInput(event.target.value);
              setHistoryIndex(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={isBusy}
            spellCheck={false}
            autoComplete="off"
          />
          {ghost && !isBusy && (
            <span className="composer-ghost" aria-hidden="true">
              <span className="composer-ghost-spacer">{input}</span>
              <span>{ghost}</span>
            </span>
          )}
        </div>
      </div>
      <p className="composer-hint">
        <kbd>ctrl</kbd>
        <span className="hint-plus">+</span>
        <kbd>shift</kbd>
        <span className="hint-plus">+</span>
        <kbd>↵</kbd>
        <span className="hint-text">start an AI prompt</span>
        <span className="hint-divider">·</span>
        <kbd>↑</kbd>
        <kbd>↓</kbd>
        <span className="hint-text">history</span>
        <span className="hint-divider">·</span>
        <kbd>tab</kbd>
        <span className="hint-text">accept suggestion</span>
      </p>
    </form>
  );
}
