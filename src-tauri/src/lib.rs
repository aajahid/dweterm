use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::Command,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, State};

const CWD_MARKER: &str = "__DWETERM_CWD__";
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Deserialize)]
struct DweTermConfig {
    ollama: OllamaConfig,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OllamaConfig {
    base_url: String,
    model: String,
    timeout_ms: u64,
    system_prompt: String,
    enable_command_execution: bool,
}

#[derive(Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaChatMessage>,
    stream: bool,
}

#[derive(Serialize)]
struct OllamaChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OllamaChatResponse {
    message: Option<OllamaResponseMessage>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct OllamaResponseMessage {
    content: Option<String>,
    thinking: Option<String>,
}

#[derive(Deserialize)]
struct OllamaChatStreamChunk {
    message: Option<OllamaResponseMessage>,
    content: Option<String>,
    thinking: Option<String>,
    done: Option<bool>,
    error: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AiStreamChunkEvent {
    block_id: String,
    kind: String,
    text: String,
}

struct ShellState {
    cwd: Mutex<PathBuf>,
}

static CACHED_SHELL_VERSION: OnceLock<String> = OnceLock::new();

fn config_candidates() -> Result<Vec<PathBuf>, String> {
    let current_dir = std::env::current_dir()
        .map_err(|error| format!("failed to read current directory: {error}"))?;
    let mut candidates = vec![current_dir.join("dweterm.config.json")];

    if let Some(parent) = current_dir.parent() {
        candidates.push(parent.join("dweterm.config.json"));
    }

    if let Some(grandparent) = current_dir.parent().and_then(|parent| parent.parent()) {
        candidates.push(grandparent.join("dweterm.config.json"));
    }

    Ok(candidates)
}

fn load_config() -> Result<DweTermConfig, String> {
    let candidates = config_candidates()?;

    for path in &candidates {
        if !path.exists() {
            continue;
        }

        let config = fs::read_to_string(path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;

        return serde_json::from_str(&config)
            .map_err(|error| format!("failed to parse {}: {error}", path.display()));
    }

    let searched_paths = candidates
        .iter()
        .map(|path| path.display().to_string())
        .collect::<Vec<_>>()
        .join(", ");

    Err(format!(
        "dweterm.config.json was not found; searched: {searched_paths}"
    ))
}

fn compose_agent_system_prompt(base_prompt: &str) -> String {
    format!(
        r#"{base_prompt}

You are operating in DweTerm agent mode. Convert user intent into terminal actions whenever possible.

Response contract:
1) Always include a machine-readable JSON block between <agent_json> and </agent_json>.
2) JSON must be a single object with shape:
{{
  "mode": "command" | "clarify" | "explain",
  "summary": "short summary",
  "commands": [
    {{
      "id": "step_1",
      "shell": "powershell",
      "command": "command string",
      "cwd": null,
      "risk": "safe" | "caution" | "dangerous",
      "requires_confirmation": true | false,
      "reason": "why this step exists"
    }}
  ],
  "validation": ["optional validation checks"],
  "questions": ["only if clarification needed"]
}}

Safety:
- Prefer safe read-only commands first.
- Mark risky operations as caution/dangerous.
- Never hide risk in explanation text."#
    )
}

fn ask_local_llm_blocking(prompt: String) -> Result<String, String> {
    let config = load_config()?.ollama;
    let _command_execution_enabled = config.enable_command_execution;
    let url = format!("{}/api/chat", config.base_url.trim_end_matches('/'));
    let request = OllamaChatRequest {
        model: config.model,
        messages: vec![
            OllamaChatMessage {
                role: "system".to_string(),
                content: compose_agent_system_prompt(&config.system_prompt),
            },
            OllamaChatMessage {
                role: "user".to_string(),
                content: prompt,
            },
        ],
        stream: false,
    };
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(config.timeout_ms))
        .build()
        .map_err(|error| format!("failed to create Ollama client: {error}"))?;
    let response = client
        .post(url)
        .json(&request)
        .send()
        .map_err(|error| format!("failed to reach Ollama: {error}"))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("failed to read Ollama response: {error}"))?;

    if !status.is_success() {
        return Err(format!("Ollama returned {status}: {body}"));
    }

    let response = serde_json::from_str::<OllamaChatResponse>(&body)
        .map_err(|error| format!("failed to parse Ollama response: {error}"))?;

    if let Some(error) = response.error {
        return Err(format!("Ollama error: {error}"));
    }

    let content = response
        .message
        .and_then(|message| message.content)
        .map(|content| content.trim().to_string())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "Ollama returned an empty response".to_string())?;

    Ok(content)
}

fn emit_ai_chunk(
    app: &AppHandle,
    block_id: &str,
    kind: &str,
    text: &str,
) -> Result<(), String> {
    app.emit(
        "dweterm://ai-stream-chunk",
        AiStreamChunkEvent {
            block_id: block_id.to_string(),
            kind: kind.to_string(),
            text: text.to_string(),
        },
    )
    .map_err(|error| format!("failed to emit AI stream chunk: {error}"))
}

fn ask_local_llm_stream_blocking(
    prompt: String,
    block_id: String,
    app: AppHandle,
) -> Result<String, String> {
    let config = load_config()?.ollama;
    let _command_execution_enabled = config.enable_command_execution;
    let url = format!("{}/api/chat", config.base_url.trim_end_matches('/'));
    let request = OllamaChatRequest {
        model: config.model,
        messages: vec![
            OllamaChatMessage {
                role: "system".to_string(),
                content: compose_agent_system_prompt(&config.system_prompt),
            },
            OllamaChatMessage {
                role: "user".to_string(),
                content: prompt,
            },
        ],
        stream: true,
    };
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(config.timeout_ms))
        .build()
        .map_err(|error| format!("failed to create Ollama client: {error}"))?;
    let response = client
        .post(url)
        .json(&request)
        .send()
        .map_err(|error| format!("failed to reach Ollama: {error}"))?;
    let status = response.status();

    if !status.is_success() {
        let body = response
            .text()
            .map_err(|error| format!("failed to read Ollama error response: {error}"))?;
        return Err(format!("Ollama returned {status}: {body}"));
    }

    let mut response_text = String::new();
    let reader = BufReader::new(response);

    for line in reader.lines() {
        let line = line.map_err(|error| format!("failed to read Ollama stream chunk: {error}"))?;
        let trimmed = line.trim();

        if trimmed.is_empty() {
            continue;
        }

        let chunk = serde_json::from_str::<OllamaChatStreamChunk>(trimmed)
            .map_err(|error| format!("failed to parse Ollama stream chunk: {error}"))?;

        if let Some(error) = chunk.error {
            return Err(format!("Ollama error: {error}"));
        }

        let message_thinking = chunk.message.as_ref().and_then(|message| message.thinking.clone());
        let message_content = chunk.message.as_ref().and_then(|message| message.content.clone());
        let thinking = chunk.thinking.or(message_thinking);
        let content = chunk.content.or(message_content);

        if let Some(thinking) = thinking.filter(|value| !value.is_empty()) {
            emit_ai_chunk(&app, &block_id, "thinking", &thinking)?;
        }

        if let Some(content) = content.filter(|value| !value.is_empty()) {
            response_text.push_str(&content);
            emit_ai_chunk(&app, &block_id, "response", &content)?;
        }

        if chunk.done.unwrap_or(false) {
            break;
        }
    }

    if response_text.trim().is_empty() {
        return Err("Ollama returned an empty response".to_string());
    }

    Ok(response_text.trim().to_string())
}

impl Default for ShellState {
    fn default() -> Self {
        Self {
            cwd: Mutex::new(std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))),
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GitInfo {
    branch: Option<String>,
    dirty: u32,
    ahead: u32,
    behind: u32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ShellInfo {
    app_version: String,
    shell_name: String,
    shell_version: String,
    cwd: String,
    home_dir: Option<String>,
    git: Option<GitInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CommandResult {
    command: String,
    stdout: String,
    stderr: String,
    exit_code: i32,
    cwd: String,
    duration_ms: u64,
    shell_info: ShellInfo,
}

fn detect_shell_version() -> String {
    if let Some(cached) = CACHED_SHELL_VERSION.get() {
        return cached.clone();
    }

    let detected = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$PSVersionTable.PSVersion.ToString()",
        ])
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if raw.is_empty() {
                    None
                } else {
                    Some(raw)
                }
            } else {
                None
            }
        })
        .unwrap_or_else(|| "unknown".to_string());

    let _ = CACHED_SHELL_VERSION.set(detected.clone());
    detected
}

fn collect_git_info(cwd: &Path) -> Option<GitInfo> {
    let output = Command::new("git")
        .args(["status", "--porcelain=v2", "--branch"])
        .current_dir(cwd)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout).into_owned();
    let mut branch: Option<String> = None;
    let mut ahead: u32 = 0;
    let mut behind: u32 = 0;
    let mut dirty: u32 = 0;

    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("# branch.head ") {
            let trimmed = rest.trim();
            if !trimmed.is_empty() && trimmed != "(detached)" {
                branch = Some(trimmed.to_string());
            }
        } else if let Some(rest) = line.strip_prefix("# branch.ab ") {
            let mut parts = rest.split_whitespace();
            if let Some(part) = parts.next() {
                ahead = part.trim_start_matches('+').parse().unwrap_or(0);
            }
            if let Some(part) = parts.next() {
                behind = part.trim_start_matches('-').parse().unwrap_or(0);
            }
        } else if !line.starts_with('#') && !line.is_empty() {
            dirty += 1;
        }
    }

    Some(GitInfo {
        branch,
        dirty,
        ahead,
        behind,
    })
}

fn home_dir_string() -> Option<String> {
    std::env::var("USERPROFILE")
        .ok()
        .or_else(|| std::env::var("HOME").ok())
}

fn collect_shell_info(cwd: &Path) -> ShellInfo {
    ShellInfo {
        app_version: format!("v{APP_VERSION}"),
        shell_name: "PowerShell".to_string(),
        shell_version: detect_shell_version(),
        cwd: cwd.display().to_string(),
        home_dir: home_dir_string(),
        git: collect_git_info(cwd),
    }
}

#[tauri::command]
fn get_shell_info(state: State<'_, ShellState>) -> Result<ShellInfo, String> {
    let cwd = state
        .cwd
        .lock()
        .map_err(|_| "shell state lock poisoned".to_string())?
        .clone();
    Ok(collect_shell_info(&cwd))
}

#[tauri::command]
async fn ask_local_llm(prompt: String) -> Result<String, String> {
    let prompt = prompt.trim().to_string();

    if prompt.is_empty() {
        return Err("AI prompt is empty".to_string());
    }

    tauri::async_runtime::spawn_blocking(move || ask_local_llm_blocking(prompt))
        .await
        .map_err(|error| format!("AI request task failed: {error}"))?
}

#[tauri::command]
async fn ask_local_llm_stream(
    app: AppHandle,
    prompt: String,
    block_id: String,
) -> Result<String, String> {
    let prompt = prompt.trim().to_string();
    let block_id = block_id.trim().to_string();

    if prompt.is_empty() {
        return Err("AI prompt is empty".to_string());
    }

    if block_id.is_empty() {
        return Err("AI block ID is empty".to_string());
    }

    tauri::async_runtime::spawn_blocking(move || ask_local_llm_stream_blocking(prompt, block_id, app))
        .await
        .map_err(|error| format!("AI request task failed: {error}"))?
}

fn build_powershell_script(command: &str) -> String {
    format!(
        r#"$global:LASTEXITCODE = $null
try {{
  & {{
{command}
  }}
  $dwetermSucceeded = $?
  $dwetermNativeExitCode = $global:LASTEXITCODE
  if ($null -ne $dwetermNativeExitCode) {{
    $dwetermExitCode = [int]$dwetermNativeExitCode
  }} elseif ($dwetermSucceeded) {{
    $dwetermExitCode = 0
  }} else {{
    $dwetermExitCode = 1
  }}
}} catch {{
  Write-Error $_
  $dwetermExitCode = 1
}} finally {{
  Write-Output "`n{CWD_MARKER}$((Get-Location).ProviderPath)"
}}
exit $dwetermExitCode"#
    )
}

fn split_stdout_and_cwd(stdout: String) -> (String, Option<PathBuf>) {
    let mut lines = stdout.lines().map(str::to_string).collect::<Vec<_>>();
    let cwd = lines
        .iter()
        .rposition(|line| line.starts_with(CWD_MARKER))
        .map(|index| {
            let line = lines.remove(index);
            PathBuf::from(line.trim_start_matches(CWD_MARKER).trim())
        });
    let cleaned_stdout = lines.join("\n");

    (cleaned_stdout, cwd)
}

#[tauri::command]
fn run_shell_command(
    state: State<'_, ShellState>,
    command: String,
) -> Result<CommandResult, String> {
    let command = command.trim().to_string();

    if command.is_empty() {
        return Err("command is empty".to_string());
    }

    let cwd = state
        .cwd
        .lock()
        .map_err(|_| "shell state lock poisoned".to_string())?
        .clone();
    let script = build_powershell_script(&command);
    let started_at = Instant::now();
    let output = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &script,
        ])
        .current_dir(&cwd)
        .output()
        .map_err(|error| format!("failed to run PowerShell command: {error}"))?;
    let duration_ms = started_at.elapsed().as_millis().min(u128::from(u64::MAX)) as u64;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let (stdout, next_cwd) = split_stdout_and_cwd(stdout);
    let next_cwd = next_cwd.unwrap_or(cwd);

    {
        let mut stored_cwd = state
            .cwd
            .lock()
            .map_err(|_| "shell state lock poisoned".to_string())?;
        *stored_cwd = next_cwd.clone();
    }

    let shell_info = collect_shell_info(&next_cwd);

    Ok(CommandResult {
        command,
        stdout,
        stderr,
        exit_code: output.status.code().unwrap_or(1),
        cwd: next_cwd.display().to_string(),
        duration_ms,
        shell_info,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ShellState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            ask_local_llm,
            ask_local_llm_stream,
            run_shell_command,
            get_shell_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
