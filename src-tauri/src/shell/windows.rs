use std::path::Path;
use std::process::Command;
use std::sync::OnceLock;

use super::{split_stdout_and_cwd, RunOutput, CWD_MARKER};

pub const SHELL_NAME: &str = "PowerShell";
pub const SHELL_KEY: &str = "powershell";
pub const PATH_SEPARATOR: &str = "\\";

static CACHED_SHELL_VERSION: OnceLock<String> = OnceLock::new();

pub fn detect_version() -> String {
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

pub fn home_dir() -> Option<String> {
    std::env::var("USERPROFILE")
        .ok()
        .or_else(|| std::env::var("HOME").ok())
}

fn build_script(command: &str) -> String {
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

pub fn run(cwd: &Path, command: &str) -> std::io::Result<RunOutput> {
    let script = build_script(command);
    let output = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &script,
        ])
        .current_dir(cwd)
        .output()?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let (stdout, next_cwd) = split_stdout_and_cwd(stdout);

    Ok(RunOutput {
        stdout,
        stderr,
        exit_code: output.status.code().unwrap_or(1),
        next_cwd,
    })
}
