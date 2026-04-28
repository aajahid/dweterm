use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    process::Command,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::State;

const CWD_MARKER: &str = "__DWETERM_CWD__";

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
    content: String,
}

struct ShellState {
    cwd: Mutex<PathBuf>,
}

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

fn ask_local_llm_blocking(prompt: String) -> Result<String, String> {
    let config = load_config()?.ollama;
    let _command_execution_enabled = config.enable_command_execution;
    let url = format!("{}/api/chat", config.base_url.trim_end_matches('/'));
    let request = OllamaChatRequest {
        model: config.model,
        messages: vec![
            OllamaChatMessage {
                role: "system".to_string(),
                content: config.system_prompt,
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
        .map(|message| message.content.trim().to_string())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "Ollama returned an empty response".to_string())?;

    Ok(content)
}

impl Default for ShellState {
    fn default() -> Self {
        Self {
            cwd: Mutex::new(std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))),
        }
    }
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

    Ok(CommandResult {
        command,
        stdout,
        stderr,
        exit_code: output.status.code().unwrap_or(1),
        cwd: next_cwd.display().to_string(),
        duration_ms,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ShellState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![ask_local_llm, run_shell_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
