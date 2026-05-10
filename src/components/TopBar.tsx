import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type TopBarProps = {
  onSearch?: (query: string) => void;
};

export function TopBar({ onSearch }: TopBarProps) {
  const [query, setQuery] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch?.(query.trim());
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  useEffect(() => {
    const syncMaximizedState = async () => {
      try {
        setIsMaximized(await invoke<boolean>("window_is_maximized"));
      } catch {
        // No-op when platform window state is unavailable.
      }
    };

    void syncMaximizedState();

    const interval = window.setInterval(() => {
      void syncMaximizedState();
    }, 600);

    return () => window.clearInterval(interval);
  }, []);

  const handleMinimize = async () => {
    await invoke("window_minimize");
  };

  const handleToggleMaximize = async () => {
    const nextState = await invoke<boolean>("window_toggle_maximize");
    setIsMaximized(nextState);
  };

  const handleClose = async () => {
    await invoke("window_close");
  };

  return (
    <header className="top-bar" data-tauri-drag-region>
      <div className="top-bar-left">
        <button
          type="button"
          className="top-icon-button no-drag"
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
        >
          <SidebarIcon />
        </button>
      </div>

    <div></div>
    

      <div className="top-bar-right">
        <div className="window-controls no-drag" aria-label="Window controls">
          <button
            type="button"
            className="window-control-button"
            aria-label="Minimize window"
            title="Minimize"
            onClick={() => void handleMinimize()}
          >
            <MinimizeIcon />
          </button>
          <button
            type="button"
            className="window-control-button"
            aria-label={isMaximized ? "Restore window" : "Maximize window"}
            title={isMaximized ? "Restore" : "Maximize"}
            onClick={() => void handleToggleMaximize()}
          >
            {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>
          <button
            type="button"
            className="window-control-button window-control-close"
            aria-label="Close window"
            title="Close"
            onClick={() => void handleClose()}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </header>
  );
}

function SidebarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="11"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <line x1="6" y1="2.5" x2="6" y2="13.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.85" />
      <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.85" />
      <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.85" />
      <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle
        cx="7"
        cy="7"
        r="4.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <line
        x1="10.4"
        y1="10.4"
        x2="13.5"
        y2="13.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <rect
        x="3.5"
        y="3.5"
        width="9"
        height="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <rect
        x="5"
        y="3"
        width="7"
        height="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M4 6V12h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
