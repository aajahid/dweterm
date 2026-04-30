# DweTerm Plan

This file tracks current implementation direction and next milestones.

## Product Direction

DweTerm is a Tauri desktop command workspace with Warp/Cursor-style blocks.

- React owns input/output rendering and block UX.
- Rust/Tauri owns non-interactive PowerShell execution and local Ollama calls.
- AI behavior is command-first with explicit safety controls.

## Current MVP Scope

1. Block-based command and AI history with prompt headers and shell metadata.
2. Local Ollama integration with streamed AI output.
3. Structured agent payload parsing from AI responses.
4. Agent loop that auto-runs safe commands and requires confirmation for risky commands.
5. Explicit error surfaces for parse failures, policy blocks, and command failures.

## Out Of Scope For Current MVP

- Full PTY/interactive terminal emulation.
- Automatic execution of dangerous commands without user confirmation.
- Cloud LLM orchestration and remote tool execution.

## Near-Term Milestones

1. Harden parser and risk policy with richer command classification and tests.
2. Add per-step retry/skip controls for failed agent actions.
3. Add settings UI for prompt contract tuning and policy strictness.
4. Add richer audit trail for agent-run command chains.
5. Linux Support
6. Mac Support
