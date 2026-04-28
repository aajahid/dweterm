# DweTerm Progress

This file is the project memory for DweTerm. Future AI agents should read this file before changing architecture, behavior, or project direction.

Record significant decisions, milestones, and AI-made changes here. Keep entries concise, dated, and specific.

## Current Status

The project has its initial Tauri, React, TypeScript, and xterm.js scaffold. The app now starts a PowerShell-backed PTY session from the Tauri backend and connects it to the xterm.js frontend. Ollama integration is not implemented yet.

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

## Progress Log

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
