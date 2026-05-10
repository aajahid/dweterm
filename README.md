# DweTerm

DweTerm is an AI-aware command workspace built with Tauri, React, and TypeScript. It runs the host's default shell (PowerShell on Windows, Bash on Linux, Zsh on macOS) for command execution and uses a local Ollama model for AI prompts.

The app uses a Warp/Cursor-style block console instead of direct terminal emulation. React owns the command input and output rendering, while the Tauri backend runs non-interactive shell commands and sends natural-language prompts to a configured local Ollama model.

## Current Status

The project has a Warp-style command workspace. The app uses a custom frameless window (native title bar removed) with a slim top toolbar (sidebar/grid toggles, center search, profile area, custom minimize/maximize/close controls), a scrollable block history, a status bar with chips for shell, working directory, git branch, and dirty count, and a single-line composer with ghost autocomplete from history. Commands run as non-interactive executions of the host shell (PowerShell on Windows, Bash on Linux, Zsh on macOS); each block shows a colored prompt header line (app version, path, `git:(branch)`, dirty/ahead/behind counts, duration) above the command and its output. Natural-language prompts render as `/agent` blocks backed by local Ollama.

## Supported Platforms

DweTerm is built for desktop and detects the host platform at compile time. Each platform is built into its own binary; only the active platform's shell integration is included in the release.

| Platform | Default shell | Status |
| --- | --- | --- |
| Windows 10/11 | PowerShell | Supported |
| Linux (Arch, Ubuntu, Fedora, etc.) | Bash | Supported |
| macOS | Zsh | Supported |

User-selectable consoles are not implemented yet; the codebase is organized so a runtime shell registry can be added without changing call sites.

## Prerequisites

Common to every platform:

- Node.js LTS with npm.
- Rust and Cargo from [rustup](https://www.rust-lang.org/tools/install).
- Ollama from [ollama.com](https://ollama.com/) for local AI responses.
- Git on `PATH` (used to compute branch and dirty counts in the status bar).

### Windows

- Tauri Windows prerequisites from the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/).
- Microsoft Edge WebView2 Runtime, usually already present on Windows 10/11.
- Visual Studio Build Tools with the C++ workload and a Windows 10/11 SDK so MSVC can link.
- PowerShell (ships with Windows).

### Linux

- Bash (ships with every supported distro).
- Tauri Linux prerequisites from the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/), typically:
  - `webkit2gtk-4.1` (or `webkit2gtk-4.0` on older distros)
  - `libssl-dev` / `openssl`
  - `libgtk-3-dev`
  - `libayatana-appindicator3-dev`
  - `librsvg2-dev`
  - `build-essential` / equivalent toolchain (`gcc`, `make`, `pkg-config`).

### macOS

- Zsh (ships with macOS).
- Xcode Command Line Tools (`xcode-select --install`) so Rust crates with native toolchains can compile.
- Tauri macOS prerequisites from the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/), including an up-to-date Xcode/macOS SDK.

DweTerm is intentionally developed host-native for the desktop workflow. Tauri needs access to native windowing, the platform webview, and host shell processes.

## Setup

Install JavaScript dependencies (works in any shell):

```bash
npm install
```

If registry access is unreliable, configure npm to use a reachable registry before installing dependencies.

If Rust is not available in your shell, install it and reopen the terminal before running Tauri commands:

```bash
rustup --version
cargo --version
```

On Windows, Rust also needs the MSVC linker and Windows SDK libraries. Install the Tauri Windows prerequisites, including Visual Studio Build Tools with the C++ workload and a Windows 10/11 SDK. If `cargo check` reports `link.exe` or `kernel32.lib` errors, the native build tools are not fully available yet.

On Windows, Cargo compiles and runs unsigned local build script executables while checking Tauri dependencies. If Windows Application Control blocks those generated `build-script-build.exe` files, Rust/Tauri validation and `npm run tauri dev` will not complete until the local Cargo build output is allowed by policy.

On Linux, install the system libraries listed in the Linux prerequisites section before running `cargo check` or `npm run tauri dev`. Missing `webkit2gtk` or `gtk-3` headers surface as `pkg-config` errors during the Tauri build.

## Run In Development

Start the desktop app (works on Windows, Linux, and macOS):

```bash
npm run tauri dev
```

Run only the Vite frontend during UI work:

```bash
npm run dev
```

## Command Workspace

DweTerm renders each submission as a block:

- Shell commands run through the host's default shell:
  - Windows: `powershell.exe -NoLogo -NoProfile -NonInteractive -Command <script>`.
  - Linux: `bash -c <script>` (no profile sourced).
  - macOS: `zsh -c <script>` (no profile sourced).
- Each block has a Warp-style prompt header showing app version, path (with `~` for the user's home), `git:(branch)`, dirty/ahead/behind counts, and elapsed time.
- Command blocks show stdout, stderr, exit status, and current working directory.
- Directory changes such as `cd ..` are tracked for later command blocks (each platform appends a `__DWETERM_CWD__` marker after the user command so the host can re-anchor cwd).
- A status bar above the composer shows the live shell name and version, current path, git branch, and `± N` dirty file count.
- Interactive terminal programs and full-screen TUIs are outside the current MVP scope.

### Platform-Aware Architecture

- The Rust backend uses `#[cfg(target_os = ...)]` to compile only the host platform's shell module. `src-tauri/src/shell/windows.rs`, `src-tauri/src/shell/linux.rs`, and `src-tauri/src/shell/macos.rs` expose the same surface (`SHELL_NAME`, `SHELL_KEY`, `detect_version`, `home_dir`, `run`) so the rest of the backend is platform-agnostic. Cross-platform helpers (git status parsing, cwd marker handling) live in `src-tauri/src/shell/mod.rs` and `src-tauri/src/shell/git.rs`.
- The frontend keeps per-shell metadata under `src/lib/shells/` (`powershell.ts`, `bash.ts`, `zsh.ts`) and dispatches via `ShellInfo.shellKey` returned by the backend. Command starter lists, dangerous/caution risk patterns, and the path separator used in prompt headers all live in those profiles.
- This split keeps each release binary free of the other platform's shell integration while leaving an obvious seam for a future "user-selectable console" feature: replace the cfg-only re-export in `shell/mod.rs` with a registry indexed by user choice, and add new `src/lib/shells/<key>.ts` profiles.

### Composer Shortcuts

- `Enter` runs the current command or routes natural language to the local AI agent.
- `Ctrl + Shift + Enter` forces an `/agent` conversation regardless of the input shape.
- `↑` / `↓` navigates the in-session command history; the partially-typed line is preserved as a draft.
- `Tab` or `→` (at end of line) accepts the ghost autocomplete suggested from history.

## AI Prompt Detection

DweTerm inspects the submitted input before deciding whether it is a command or an AI prompt.

- Ordinary shell commands (PowerShell cmdlets on Windows, bash builtins/utilities on Linux, zsh utilities on macOS), paths, assignments, flags, and command separators run as command blocks.
- Likely natural-language questions or requests are intercepted and sent to local Ollama.
- Prefix a line with `ai:` to force AI routing, for example `ai: explain Get-ChildItem` on Windows or `ai: explain ls -al` on Linux.
- AI responses stream into AI blocks chunk-by-chunk as they are generated.
- If the model emits thinking text, DweTerm renders it in a separate "thinking" section from the final response section.
- When AI generation completes, the thinking section auto-collapses; users can expand or collapse it manually with a chevron toggle.
- Set `ollama.enableThinking` in the user config file to toggle whether DweTerm requests model thinking output (`true`) or asks Ollama for non-thinking responses (`false`).
- The response section now uses the parsed agent plan summary, so no separate `agent_text` envelope is required.
- While the model is streaming the `agent_json` envelope, AI blocks show an animated loading line that reads `Command is generating` with pulsing dots and a shimmering label.
- AI output is display-only; it is not sent to the host shell or executed.

## Warp-Style Agent Loop

DweTerm now supports a structured command-agent loop on AI blocks.

- The backend prompt asks the model for a parseable machine payload (`<agent_json> ... </agent_json>`) only.
- The backend injects the active shell key (`powershell` on Windows, `bash` on Linux, `zsh` on macOS) into the prompt so the model only emits commands the host can run.
- The frontend parses the payload into an agent plan with ordered shell steps for the active shell.
- `safe` steps are auto-executed through the normal command runner.
- `caution` and `dangerous` steps are held for explicit user approval before execution. Risk patterns are loaded from the active shell profile in `src/lib/shells/`.
- If parsing fails or the payload is missing, the block surfaces a parse error note.
- Command policy is conservative: ambiguous commands are treated as confirmation-required.

### Agent Output Contract

The expected machine payload is:

```json
{
  "mode": "command | clarify | explain",
  "summary": "short summary",
  "commands": [
    {
      "id": "step_1",
      "shell": "powershell | bash | zsh",
      "command": "string",
      "cwd": null,
      "risk": "safe | caution | dangerous",
      "requires_confirmation": true,
      "reason": "why this command exists"
    }
  ],
  "validation": [],
  "questions": []
}
```

## Build

Build the frontend:

```bash
npm run build
```

Build the desktop bundle (produces a Windows `.msi`/`.exe` on Windows or a Linux `.deb`/`.AppImage`/`.rpm` on Linux):

```bash
npm run tauri build
```

## Ollama Setup

The first AI provider is local Ollama. Before using AI prompts, make sure Ollama is running:

```bash
ollama serve
```

Check available local models:

```bash
ollama list
```

On first run, DweTerm migrates `dweterm.config.json` into the user's home directory and then always reads from that user-writable file:

- macOS/Linux: `~/dweterm.config.json`
- Windows: `%USERPROFILE%\dweterm.config.json`

If no source config is found during first run, DweTerm seeds the user config file using the built-in default values.

Default config shape:

```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "llama3.2",
    "timeoutMs": 30000,
    "systemPrompt": "You are DweTerm's local terminal assistant. Prioritize actionable shell steps for the host's default shell, keep safety explicit, and output structured agent actions plus a short explanation.",
    "enableCommandExecution": false,
    "enableThinking": true
  }
}
```

Change `model` to a model that exists in your local Ollama installation.

## Project Memory

Important decisions and progress are recorded in `PROGRESS.md`. Future changes should stay aligned with `PLAN.md` unless the direction is intentionally updated there and logged in `PROGRESS.md`.
