# DweTerm Progress

This file is the project memory for DweTerm. Future AI agents should read this file before changing architecture, behavior, or project direction.

Record significant decisions, milestones, and AI-made changes here. Keep entries concise, dated, and specific.

## Current Status

The project has its initial Tauri, React, TypeScript, and local Ollama scaffold. The app has pivoted from direct terminal emulation to a Warp/Cursor-style block command workspace where React owns input and output rendering, while the Tauri backend runs non-interactive PowerShell commands and local AI prompts. The UI has been restyled to mirror Warp: a slim top toolbar (sidebar/grid toggles, center search, profile cluster), monospace prompt headers per block (app version, path, `git:(branch)`, dirty/ahead/behind, duration), a status chip bar (shell, cwd, branch, ± dirty count), and a single-line composer with ghost-text autocomplete and history navigation.

## Decisions

### 2026-04-28: Product Direction

DweTerm will be a desktop terminal emulator built with Tauri, React, and xterm.js.

The core product idea is a terminal that behaves normally for shell commands but can also detect natural-language prompts. Natural-language prompts will be sent to a configured local AI model and the response will appear inside the terminal.

### 2026-04-28: Default Shell

The first target platform is Windows, and the default shell should be PowerShell.

### 2026-04-28: AI Provider

The first AI provider is local Ollama. The project assumes Ollama is already installed and running on the host machine. DweTerm should not bundle Ollama and should not require Docker services for the MVP.

### 2026-04-28: Development Workflow

DweTerm should use host-native development for the desktop application. Docker is not planned for the initial workflow because Tauri, native windowing, WebView2, shell spawning, and PTY behavior need to interact with the host operating system directly.

### 2026-04-28: Configuration

The first version should use a configuration file for AI settings. A settings UI is intentionally deferred until after the MVP terminal and AI loop are working.

### 2026-04-28: Command Execution Safety

AI-generated commands should not be treated as ordinary prose. They should be parsed through a deliberate command execution path. Risk controls and user confirmation should be added before enabling broad agentic command execution.

### 2026-04-29: Block Console Pivot

DweTerm's primary MVP is now an AI command workspace instead of a direct terminal emulator.

The app should favor React-rendered command and AI blocks, custom input styling, structured stdout/stderr/exit metadata, and explicit command safety surfaces. Non-interactive PowerShell command execution is the first backend. Full terminal emulation, PTY sessions, interactive TUIs, and raw xterm rendering are no longer part of the primary MVP path.

## Progress Log

### 2026-05-09: User-Configurable LLM Settings Migration

Moved LLM config loading to a per-user config path so end users can edit settings outside source code.

Reasoning:

- The previous loader read `dweterm.config.json` from repository-relative paths, which is not user-editable in packaged installs.
- On first run, the backend now provisions a user config file in the user's home directory and migrates from an existing source config file when available.
- Subsequent AI requests always read `~/dweterm.config.json` (or `%USERPROFILE%\dweterm.config.json` on Windows), so changing model/base URL/timeout takes effect without rebuilding the app.
- Migration logic now copies source config content to the user config file and never moves or deletes the source file from the repository.
- When migration source is unavailable, the app seeds the user config file from the compiled default config template.

Files changed:

- `src-tauri/src/lib.rs`
- `README.md`
- `PROGRESS.md`

### 2026-05-08: macOS/Zsh Platform Support

Added macOS host support using Zsh while preserving the compile-time platform split used by Windows and Linux.

Reasoning:

- The project already isolated per-platform shell code (`src-tauri/src/shell/<os>.rs`) and per-shell frontend profiles (`src/lib/shells/<key>.ts`), so macOS support should follow the same seam instead of introducing special runtime branches.
- The backend now compiles a dedicated macOS shell module that executes commands with `zsh -c`, detects Zsh version, and preserves cwd tracking via the existing `__DWETERM_CWD__` marker flow.
- The frontend now recognizes a `zsh` shell key and routes command detection/risk policy through a new Zsh shell profile.
- Project docs now mark macOS as supported and document macOS prerequisites/behavior.

Files changed:

- `src-tauri/src/shell/mod.rs`
- `src-tauri/src/shell/macos.rs`
- `src/lib/shells/types.ts`
- `src/lib/shells/index.ts`
- `src/lib/shells/zsh.ts`
- `README.md`
- `PLAN.md`
- `PROGRESS.md`

### 2026-04-28: Initial Documentation

Created initial project documentation plan for:

- `README.md`
- `PLAN.md`
- `PROGRESS.md`

The documentation establishes the project goals, host-native development direction, local Ollama assumption, MVP scope, and project memory process.

### 2026-04-28: Plan Updated for Host-Native Workflow

Updated `PLAN.md` to make the development workflow decision explicit.

Reasoning:

- DweTerm is a desktop terminal emulator and needs direct access to native desktop APIs, WebView2, PowerShell, and PTY behavior.
- Ollama is already running locally on the host, so there are no external service dependencies that need Docker Compose.
- Docker would make the interactive desktop development loop harder rather than simpler for the MVP.

Files changed:

- `PLAN.md`
- `PROGRESS.md`

### 2026-04-28: Initial Application Scaffold

Created the first host-native Tauri + React + TypeScript scaffold and replaced the generated demo view with a minimal DweTerm terminal placeholder using xterm.js.

Reasoning:

- The scaffold follows the documented MVP direction: desktop app first, terminal UI first, local Ollama configuration prepared for later phases.
- The UI intentionally remains a placeholder until PowerShell process control is implemented in the Tauri backend.

Files changed:

- `package.json`
- `index.html`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.node.json`
- `.gitignore`
- `.vscode/extensions.json`
- `src/App.tsx`
- `src/App.css`
- `src/main.tsx`
- `src/vite-env.d.ts`
- `src-tauri/Cargo.toml`
- `src-tauri/build.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/capabilities/default.json`
- `dweterm.config.json`
- `README.md`
- `PROGRESS.md`

### 2026-04-28: Initial Dev Environment Setup

Installed or activated the first host-native development dependencies and generated dependency lockfiles.

Reasoning:

- Node LTS is active through `fnm`, JavaScript dependencies are installed, and `npm run build` passes.
- Rust and Cargo are installed through rustup.
- Windows SDK libraries are now installed and MSVC linking is available.

Files changed:

- `package-lock.json`
- `src-tauri/Cargo.lock`
- `README.md`
- `PROGRESS.md`

### 2026-04-29: First Terminal Emulation

Implemented the first real terminal emulation path.

Reasoning:

- xterm.js should render the terminal UI while the Tauri backend owns native shell process control.
- `portable-pty` provides PTY-backed PowerShell behavior, which is closer to a real interactive terminal than standard input/output pipes.
- The frontend now forwards terminal input to the backend and listens for shell output events.
- React Strict Mode was removed because development-only double mounting can start and stop native terminal sessions unexpectedly.

Files changed:

- `src/App.tsx`
- `src/main.tsx`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/src/lib.rs`
- `README.md`
- `PROGRESS.md`

### 2026-04-29: Cursor Project Memory Rule

Added a Cursor project rule that always applies to future AI sessions.

Reasoning:

- Future agents should read `README.md`, `PLAN.md`, and `PROGRESS.md` before making architectural, behavioral, or workflow changes.
- Significant decisions and AI-made changes should continue to be recorded so the project does not drift from its documented direction.

Files changed:

- `.cursor/rules/project-memory.mdc`
- `PROGRESS.md`

### 2026-04-29: Natural-Language AI Loop

Implemented the first local AI response loop for terminal input.

Reasoning:

- DweTerm should preserve ordinary PowerShell behavior while detecting likely natural-language prompts at Enter time.
- The frontend now keeps a conservative line buffer, routes likely prose and `ai:`-prefixed input to AI, and prints `[DweTerm AI]` responses into xterm without sending AI output to the PTY.
- The Tauri backend now loads `dweterm.config.json` and calls local Ollama's `/api/chat` endpoint with `stream: false`.
- AI-generated command execution remains disabled and intentionally outside the shell write path.

Files changed:

- `src/App.tsx`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/src/lib.rs`
- `README.md`
- `PROGRESS.md`

### 2026-04-29: Warp-Style UI Overhaul

Replaced the card-style block layout with a Warp-inspired workspace.

Reasoning:

- The product needs to feel like a terminal that the user trusts, so blocks now render as monospace prompt headers + command line + output, instead of bordered cards.
- Each prompt header shows app version, working directory (with `~` substitution for the user's home), `git:(branch)`, dirty/ahead/behind counts, and duration. Branch parens are red, branch name is amber, path is blue, matching the screenshot reference.
- A new top toolbar provides sidebar/grid toggle placeholders, a centered search input, an "Update" pill, and a profile avatar. Search and toggle buttons are scaffolded UI for future features.
- A status chip bar above the composer surfaces live PowerShell version, current path, git branch, and dirty count, fed by a new Tauri `get_shell_info` command and shell info attached to every `CommandResult`.
- The composer is now a single-line input with caret-blink, ghost-text autocomplete from history, `↑`/`↓` history navigation that preserves the in-progress draft, `Tab`/`→` to accept the suggestion, and `Ctrl+Shift+Enter` to force a `/agent` conversation.
- React code was split into `components/` (TopBar, StatusBar, PromptHeader, ConsoleBlockView, Composer, EmptyState) and `lib/` (types, format helpers, input detection) for readability as more features land.
- The Rust backend now caches the PowerShell version after first detection, runs `git status --porcelain=v2 --branch` to gather branch + ahead/behind/dirty, and emits a structured `ShellInfo` payload.

Files changed:

- `src/App.tsx`
- `src/App.css`
- `src/components/TopBar.tsx`
- `src/components/StatusBar.tsx`
- `src/components/PromptHeader.tsx`
- `src/components/ConsoleBlockView.tsx`
- `src/components/Composer.tsx`
- `src/components/EmptyState.tsx`
- `src/lib/types.ts`
- `src/lib/format.ts`
- `src/lib/detectInputKind.ts`
- `src-tauri/src/lib.rs`
- `README.md`
- `PROGRESS.md`

### 2026-04-29: Block Command Workspace

Replaced the xterm/PTY MVP path with a React-managed block console.

Reasoning:

- The product needs Warp/Cursor-style control over input, output, content structure, and styling, which is difficult when the shell owns the terminal screen.
- Commands now run as non-interactive PowerShell executions and return structured stdout, stderr, exit code, duration, and cwd data.
- Natural-language prompts continue to route to local Ollama and render as AI blocks.
- The MVP intentionally excludes interactive terminal applications and raw PTY behavior.

Files changed:

- `src/App.tsx`
- `src/App.css`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/src/lib.rs`
- `package.json`
- `package-lock.json`
- `README.md`
- `PROGRESS.md`

### 2026-04-29: Streamed AI Chunks with Separate Thinking UI

Implemented chunked AI response streaming and split rendering for thinking vs final answer text.

Reasoning:

- AI output should appear immediately while Ollama is generating, instead of waiting for a full blocking response.
- Some models expose intermediate thinking tokens; those should be visible in a dedicated area so users can distinguish reasoning traces from final response content.
- Streaming updates are keyed by block ID and emitted from Tauri as frontend events, allowing multiple AI blocks over time to stay correctly associated with their own chunks.

Files changed:

- `src-tauri/src/lib.rs`
- `src/App.tsx`
- `src/lib/types.ts`
- `src/components/ConsoleBlockView.tsx`
- `src/App.css`
- `README.md`
- `PROGRESS.md`

### 2026-04-29: Collapsible AI Thinking Section

Updated AI block rendering so model thinking text auto-collapses after streaming finishes and can be manually toggled.

Reasoning:

- Thinking traces are useful but can dominate the block once the final response is available.
- Auto-collapsing completed thinking keeps history readable while preserving access to details on demand.
- A visible chevron toggle improves discoverability and gives users explicit control over expansion state.

Files changed:

- `src/components/ConsoleBlockView.tsx`
- `src/App.css`
- `README.md`
- `PROGRESS.md`

## Future Log Template

Use this format for new entries:

```markdown
### YYYY-MM-DD: Short Title

Summary of the change or decision.

Reasoning:

- Why this direction was chosen.
- Any meaningful alternatives rejected.

Files changed:

- `path/to/file`
```

### 2026-04-29: Warp-Style Agent Execution Loop

Implemented a structured agent loop that parses AI responses into command plans, auto-runs safe steps, and gates risky steps behind confirmation controls.

Reasoning:

- DweTerm needed a command-first AI path that can be safely executed instead of display-only prose.
- The model now receives an explicit response envelope contract (`agent_json` + `agent_text`) so frontend parsing is reliable.
- Risk handling is conservative by default: dangerous/caution patterns require approval; execution failures and parse failures are surfaced in the block UI.
- The existing command block runner remains the single execution path, so agent actions and manual commands share consistent stdout/stderr/exit behavior.

Files changed:

- `src/lib/types.ts`
- `src/lib/agentParser.ts`
- `src/lib/agentPolicy.ts`
- `src/App.tsx`
- `src/components/ConsoleBlockView.tsx`
- `src/App.css`
- `src-tauri/src/lib.rs`
- `dweterm.config.json`
- `README.md`
- `PLAN.md`
- `PROGRESS.md`

### 2026-04-29: Response Block Shows Agent Text Only

Updated AI response rendering so the response block only shows content from the Agent Text envelope and never displays surrounding protocol payload text.

Reasoning:

- Streaming previously appended raw model output, which could expose envelope noise beyond the intended user-facing response content.
- The frontend now extracts only text inside `agent_text` boundaries while streaming and normalizes alternate markers (`TEXT_OPEN` / `TEXT_CLOSE`) to the same envelope behavior.
- Final block completion now prefers parsed Agent Text content only, keeping the response section focused and predictable.

Files changed:

- `src/App.tsx`
- `src/lib/agentParser.ts`
- `src/components/ConsoleBlockView.tsx`
- `README.md`
- `PROGRESS.md`

### 2026-04-29: JSON Streaming Loading State

Added an explicit AI loading state for the command-writing phase while the model streams `agent_json` content.

Reasoning:

- Agent-mode responses stream protocol content first (`agent_json`) before the human-facing `agent_text`, and users need a clear indicator of what the model is doing during that gap.
- The frontend now tracks this phase per block and shows `Writing the command` while JSON is streaming and before `agent_text` begins.
- The state turns off automatically once text streaming starts or the AI block completes/errors.

Files changed:

- `src/lib/types.ts`
- `src/App.tsx`
- `src/components/ConsoleBlockView.tsx`
- `README.md`
- `PROGRESS.md`

### 2026-04-29: Removed Agent Text Envelope

Removed the `agent_text` requirement from the AI contract to reduce unnecessary generation delay and rely on structured payload data only.

Reasoning:

- The extra `agent_text` phase added latency after command JSON generation without adding essential control data.
- The frontend now surfaces the parsed plan summary as the response label text, so users still get a concise explanation.
- Stream handling now tracks only `<agent_json>` boundaries for loading-state behavior.

Files changed:

- `src-tauri/src/lib.rs`
- `src/lib/agentParser.ts`
- `src/App.tsx`
- `README.md`
- `PROGRESS.md`

### 2026-04-29: Animated Command-Generating Loading State

Replaced the plain `Writing the command` loading line with an animated indicator while the model streams the `agent_json` envelope.

Reasoning:

- Users had no visual signal that the model was actively generating; a static line is easy to mistake for a stalled stream.
- The new state renders three pulsing dots plus a shimmering `Command is generating` label, using the existing AI accent color so it reads as part of the agent flow rather than a generic spinner.
- The cursor-blink `::after` is suppressed for this specific state so the dots remain the single point of motion. Other loading states (running command, plain Ollama streaming) keep the existing blinking-cursor look.

Files changed:

- `src/components/ConsoleBlockView.tsx`
- `src/App.css`
- `README.md`
- `PROGRESS.md`

### 2026-04-30: Linux/Bash Support and Platform Split

Added Linux/Bash host shell support alongside the existing Windows/PowerShell flow and reorganized the codebase so each platform owns its shell integration in isolation.

Reasoning:

- The product needs to run on Linux without giving up the Windows path. We picked Bash as the Linux default to match the user's "bash for Linux, PowerShell for Windows" decision.
- The Rust backend now uses `#[cfg(target_os = ...)]` to compile only the active platform's shell module, so the release binary never ships the other platform's shell code. This honors the "platform-specific code in only at build time" goal.
- The new `src-tauri/src/shell/` module defines a shared surface (`SHELL_NAME`, `SHELL_KEY`, `PATH_SEPARATOR`, `detect_version`, `home_dir`, `run`) that each platform implements (`windows.rs`, `linux.rs`). Cross-platform helpers (`git.rs`, `split_stdout_and_cwd`, `RunOutput`) live in `mod.rs` so platform modules stay focused.
- Bash invocation uses `bash -c <script>` with an `EXIT` trap that prints the `__DWETERM_CWD__` marker so cwd tracking still works even when the user command calls `exit`. This mirrors the PowerShell `try/finally` behavior.
- The frontend keeps shell metadata in a parallel structure under `src/lib/shells/` (`powershell.ts`, `bash.ts`, `index.ts`, `types.ts`). Command starters, dangerous/caution risk regex lists, and the path separator used for prompt headers all live in those profiles. `applyPolicy`, `looksLikeShellCommand`, and `looksLikeNaturalLanguage` now take a `ShellKey` argument so the frontend dispatches per shell.
- `ShellInfo` (returned by `get_shell_info` / `run_shell_command`) now carries `shellKey` and `pathSeparator` so the frontend has one source of truth and does not hardcode Windows path separators.
- The agent system prompt is composed from a shell-neutral base in `dweterm.config.json` plus a Rust-side wrapper that injects the active shell key, so the model only emits commands for the host shell.
- Rationale for runtime dispatch on the frontend even though the Rust side is compile-time gated: the future "user picks a custom console" feature will require multiple shells to coexist in the JS bundle anyway, and the per-profile JS payload is tiny.

Alternatives rejected:

- Vite-side compile-time stripping of unused shell profiles. The size win was negligible and the bundler complexity would have to be undone again the moment the user-selectable console feature lands.
- Single Rust shell module with runtime branches. Cleaner cfg-gated modules give us guaranteed binary-size wins and a clear seam for the future shell registry.

Files changed:

- `src-tauri/src/shell/mod.rs` (new)
- `src-tauri/src/shell/git.rs` (new)
- `src-tauri/src/shell/windows.rs` (new)
- `src-tauri/src/shell/linux.rs` (new)
- `src-tauri/src/lib.rs`
- `src/lib/shells/types.ts` (new)
- `src/lib/shells/powershell.ts` (new)
- `src/lib/shells/bash.ts` (new)
- `src/lib/shells/index.ts` (new)
- `src/lib/types.ts`
- `src/lib/agentParser.ts`
- `src/lib/agentPolicy.ts`
- `src/lib/detectInputKind.ts`
- `src/lib/format.ts`
- `src/App.tsx`
- `dweterm.config.json`
- `README.md`
- `PLAN.md`
- `PROGRESS.md`
