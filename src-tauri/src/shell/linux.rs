use std::path::Path;
use std::process::Command;
use std::sync::OnceLock;

use super::{split_stdout_and_cwd, RunOutput, CWD_MARKER};

pub const SHELL_NAME: &str = "Bash";
pub const SHELL_KEY: &str = "bash";
pub const PATH_SEPARATOR: &str = "/";

static CACHED_SHELL_VERSION: OnceLock<String> = OnceLock::new();

pub fn detect_version() -> String {
    if let Some(cached) = CACHED_SHELL_VERSION.get() {
        return cached.clone();
    }

    let detected = Command::new("bash")
        .arg("--version")
        .output()
        .ok()
        .and_then(|output| {
            if !output.status.success() {
                return None;
            }
            let raw = String::from_utf8_lossy(&output.stdout).into_owned();
            let first_line = raw.lines().next().unwrap_or("").trim().to_string();
            if first_line.is_empty() {
                return None;
            }

            if let Some(rest) = first_line.split_once("version ").map(|(_, rest)| rest) {
                let version = rest
                    .split(|c: char| c.is_whitespace() || c == '(')
                    .next()
                    .unwrap_or("")
                    .trim();
                if !version.is_empty() {
                    return Some(version.to_string());
                }
            }

            Some(first_line)
        })
        .unwrap_or_else(|| "unknown".to_string());

    let _ = CACHED_SHELL_VERSION.set(detected.clone());
    detected
}

pub fn home_dir() -> Option<String> {
    std::env::var("HOME").ok()
}

fn build_script(command: &str) -> String {
    // Use an EXIT trap so the cwd marker is printed even when the user's
    // command calls `exit N`. Single quotes inside the trap body keep the
    // marker literal until the trap actually runs.
    format!(
        r#"__dweterm_on_exit() {{
  __dweterm_rc=$?
  printf '\n{CWD_MARKER}%s\n' "$PWD"
  exit $__dweterm_rc
}}
trap __dweterm_on_exit EXIT
{command}
"#
    )
}

pub fn run(cwd: &Path, command: &str) -> std::io::Result<RunOutput> {
    let script = build_script(command);
    let output = Command::new("bash")
        .arg("-c")
        .arg(&script)
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
