import { ChangeEvent, FormEvent, useState } from "react";

type TopBarProps = {
  onSearch?: (query: string) => void;
};

export function TopBar({ onSearch }: TopBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch?.(query.trim());
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  return (
    <header className="top-bar" data-tauri-drag-region>
      <div className="top-bar-left">
        <button
          type="button"
          className="top-icon-button"
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
        >
          <SidebarIcon />
        </button>
        <button
          type="button"
          className="top-icon-button"
          aria-label="Open grid view"
          title="Grid view"
        >
          <GridIcon />
        </button>
      </div>

      <form className="top-search" onSubmit={handleSubmit}>
        <SearchIcon />
        <input
          type="search"
          value={query}
          placeholder="Search sessions, agents, files..."
          onChange={handleChange}
          spellCheck={false}
        />
      </form>

      <div className="top-bar-right">
        <button type="button" className="update-pill" title="DweTerm is up to date">
          DweTerm Ready
        </button>
        <button
          type="button"
          className="top-icon-button"
          aria-label="Share"
          title="Share session"
        >
          <ShareIcon />
        </button>
        <button
          type="button"
          className="top-icon-button"
          aria-label="Notifications"
          title="Notifications"
        >
          <BellIcon />
        </button>
        <div className="profile-avatar" title="Account">
          DW
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

function ShareIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M8 2v8M8 2L5 5M8 2l3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 9v3.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V9"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M4 11V7a4 4 0 0 1 8 0v4l1.2 1.4H2.8z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </svg>
  );
}
