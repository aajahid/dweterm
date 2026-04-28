# DweTerm

DweTerm is a desktop terminal emulator built with Tauri, React, TypeScript, and xterm.js.

The first goal is to behave like a normal terminal. The planned AI layer will detect natural-language input, send it to a configured local Ollama model, render the response in the terminal, and only run AI-suggested commands through an explicit safety path.

## Current Status

The project has its initial Tauri + React + TypeScript scaffold and a first PowerShell-backed terminal. The frontend renders xterm.js, while the Tauri backend starts PowerShell through a PTY and streams shell output back to the UI. Ollama integration is planned next.

## Prerequisites

Install these on the host machine:

- Node.js LTS with npm.
- Rust and Cargo from [rustup](https://www.rust-lang.org/tools/install).
- Tauri Windows prerequisites from the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/).
- Microsoft Edge WebView2 Runtime, usually already present on Windows 10/11.
- Ollama from [ollama.com](https://ollama.com/) for future AI features.

DweTerm is intentionally developed host-native for the desktop workflow. Tauri needs access to native windowing, WebView2, host shell processes, and PTY behavior.

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

AI features are not wired yet, but the first provider is local Ollama. Before using those features later, make sure Ollama is running:

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
