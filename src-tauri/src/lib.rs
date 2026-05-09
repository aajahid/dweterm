use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, State};

mod shell;

use shell::{platform, CommandResult, ShellInfo};

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
const CONFIG_FILE_NAME: &str = "dweterm.config.json";
const DEFAULT_CONFIG_JSON: &str = include_str!("../../dweterm.config.json");

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

fn config_candidates() -> Result<Vec<PathBuf>, String> {
    let current_dir = std::env::current_dir()
        .map_err(|error| format!("failed to read current directory: {error}"))?;
    let mut candidates = vec![current_dir.join(CONFIG_FILE_NAME)];

    if let Some(parent) = current_dir.parent() {
        candidates.push(parent.join(CONFIG_FILE_NAME));
    }

    if let Some(grandparent) = current_dir.parent().and_then(|parent| parent.parent()) {
        candidates.push(grandparent.join(CONFIG_FILE_NAME));
    }

    Ok(candidates)
}

fn user_home_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(user_profile) = std::env::var_os("USERPROFILE") {
            return Ok(PathBuf::from(user_profile));
        }
        return Err("USERPROFILE is not set; cannot determine user home directory".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(home) = std::env::var_os("HOME") {
            return Ok(PathBuf::from(home));
        }
        Err("HOME is not set; cannot determine user home directory".to_string())
    }
}

fn user_config_path() -> Result<PathBuf, String> {
    Ok(user_home_dir()?.join(CONFIG_FILE_NAME))
}

fn ensure_user_config() -> Result<PathBuf, String> {
    let user_config_path = user_config_path()?;
    if user_config_path.exists() {
        return Ok(user_config_path);
    }

    if let Some(parent) = user_config_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to create user config directory {}: {error}",
                parent.display()
            )
        })?;
    }

    let source_config_path = config_candidates()?
        .into_iter()
        .find(|candidate| candidate.exists());

    if let Some(source_path) = source_config_path {
        if source_path != user_config_path {
            let source_contents = fs::read_to_string(&source_path)
                .map_err(|error| format!("failed to read {}: {error}", source_path.display()))?;
            fs::write(&user_config_path, source_contents)
                .map_err(|error| format!("failed to write {}: {error}", user_config_path.display()))?;
            return Ok(user_config_path);
        }
    }

    fs::write(&user_config_path, DEFAULT_CONFIG_JSON)
        .map_err(|error| format!("failed to write {}: {error}", user_config_path.display()))?;
    Ok(user_config_path)
}

fn load_config() -> Result<DweTermConfig, String> {
    let path = ensure_user_config()?;
    let config =
        fs::read_to_string(&path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    serde_json::from_str(&config).map_err(|error| format!("failed to parse {}: {error}", path.display()))
}

fn compose_agent_system_prompt(base_prompt: &str) -> String {
    let shell_key = platform::SHELL_KEY;
    let shell_name = platform::SHELL_NAME;
    format!(
        r#"{base_prompt}

You are operating in DweTerm agent mode. The host shell is {shell_name} (shell key: "{shell_key}"). Convert user intent into terminal actions whenever possible.

Response contract:
1) Always include a machine-readable JSON block between <agent_json> and </agent_json>.
2) JSON must be a single object with shape:
{{
  "mode": "command" | "clarify" | "explain",
  "summary": "short summary",
  "commands": [
    {{
      "id": "step_1",
      "shell": "{shell_key}",
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
- Never hide risk in explanation text.
- Only emit commands for the host shell ({shell_name})."#
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

fn collect_shell_info(cwd: &Path) -> ShellInfo {
    ShellInfo {
        app_version: format!("v{APP_VERSION}"),
        shell_name: platform::SHELL_NAME.to_string(),
        shell_key: platform::SHELL_KEY.to_string(),
        shell_version: platform::detect_version(),
        path_separator: platform::PATH_SEPARATOR.to_string(),
        cwd: cwd.display().to_string(),
        home_dir: platform::home_dir(),
        git: shell::git::collect_git_info(cwd),
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
    let started_at = Instant::now();
    let output = platform::run(&cwd, &command)
        .map_err(|error| format!("failed to run {} command: {error}", platform::SHELL_NAME))?;
    let duration_ms = started_at.elapsed().as_millis().min(u128::from(u64::MAX)) as u64;
    let next_cwd = output.next_cwd.unwrap_or(cwd);

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
        stdout: output.stdout,
        stderr: output.stderr,
        exit_code: output.exit_code,
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
        .setup(|_| {
            ensure_user_config()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ask_local_llm,
            ask_local_llm_stream,
            run_shell_command,
            get_shell_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
