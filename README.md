# DweTerm

DweTerm is an AI-aware command workspace built with Tauri, React, TypeScript, and PowerShell.

The app uses a Warp/Cursor-style block console instead of direct terminal emulation. React owns the command input and output rendering, while the Tauri backend runs non-interactive PowerShell commands and sends natural-language prompts to a configured local Ollama model.

## Current Status

The project has a Warp-style command workspace. The window has a slim top toolbar (sidebar/grid toggles, center search, profile area), a scrollable block history, a status bar with chips for shell, working directory, git branch, and dirty count, and a single-line composer with ghost autocomplete from history. Commands run as non-interactive PowerShell executions; each block shows a colored prompt header line (app version, path, `git:(branch)`, dirty/ahead/behind counts, duration) above the command and its output. Natural-language prompts render as `/agent` blocks backed by local Ollama.

## Prerequisites

Install these on the host machine:

- Node.js LTS with npm.
- Rust and Cargo from [rustup](https://www.rust-lang.org/tools/install).
- Tauri Windows prerequisites from the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/).
- Microsoft Edge WebView2 Runtime, usually already present on Windows 10/11.
- Ollama from [ollama.com](https://ollama.com/) for local AI responses.

DweTerm is intentionally developed host-native for the desktop workflow. Tauri needs access to native windowing, WebView2, and host shell processes.

## Setup

Install JavaScript dependencies:

```powershell
npm install
```

If registry access is unreliable, configure npm to use a reachable registry before installing dependencies.

If Rust is not available in your shell, install it and reopen the terminal before running Tauri commands:

```powershell
rustup --version
cargo --version
```

On Windows, Rust also needs the MSVC linker and Windows SDK libraries. Install the Tauri Windows prerequisites, including Visual Studio Build Tools with the C++ workload and a Windows 10/11 SDK. If `cargo check` reports `link.exe` or `kernel32.lib` errors, the native build tools are not fully available yet.

Cargo compiles and runs unsigned local build script executables while checking Tauri dependencies. If Windows Application Control blocks those generated `build-script-build.exe` files, Rust/Tauri validation and `npm run tauri dev` will not complete until the local Cargo build output is allowed by policy.

## Run In Development

Start the desktop app:

```powershell
npm run tauri dev
```

Run only the Vite frontend during UI work:

```powershell
npm run dev
```

## Command Workspace

DweTerm renders each submission as a block:

- Shell commands run through `powershell.exe -NoLogo -NoProfile -NonInteractive -Command`.
- Each block has a Warp-style prompt header showing app version, path (with `~` for the user's home), `git:(branch)`, dirty/ahead/behind counts, and elapsed time.
- Command blocks show stdout, stderr, exit status, and current working directory.
- Directory changes such as `cd ..` are tracked for later command blocks.
- A status bar above the composer shows the live PowerShell version, current path, git branch, and `± N` dirty file count.
- Interactive terminal programs and full-screen TUIs are outside the current MVP scope.

### Composer Shortcuts

- `Enter` runs the current command or routes natural language to the local AI agent.
- `Ctrl + Shift + Enter` forces an `/agent` conversation regardless of the input shape.
- `↑` / `↓` navigates the in-session command history; the partially-typed line is preserved as a draft.
- `Tab` or `→` (at end of line) accepts the ghost autocomplete suggested from history.

## AI Prompt Detection

DweTerm inspects the submitted input before deciding whether it is a command or an AI prompt.

- Ordinary shell commands, PowerShell cmdlets, paths, assignments, flags, and command separators run as command blocks.
- Likely natural-language questions or requests are intercepted and sent to local Ollama.
- Prefix a line with `ai:` to force AI routing, for example `ai: explain Get-ChildItem`.
- AI responses render as AI blocks. They are not sent to PowerShell or executed.

## Build

Build the frontend:

```powershell
npm run build
```

Build the desktop bundle:

```powershell
npm run tauri build
```

## Ollama Setup

The first AI provider is local Ollama. Before using AI prompts, make sure Ollama is running:

```powershell
ollama serve
```

Check available local models:

```powershell
ollama list
```

The initial app config lives at `dweterm.config.json`:

```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "llama3.2",
    "timeoutMs": 30000,
    "systemPrompt": "You are DweTerm's local terminal assistant. Help with shell tasks clearly and suggest commands only when they are safe and explicit.",
    "enableCommandExecution": false
  }
}
```

Change `model` to a model that exists in your local Ollama installation.

## Project Memory

Important decisions and progress are recorded in `PROGRESS.md`. Future changes should stay aligned with `PLAN.md` unless the direction is intentionally updated there and logged in `PROGRESS.md`.
