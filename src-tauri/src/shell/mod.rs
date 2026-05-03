use serde::Serialize;
use std::path::PathBuf;

pub mod git;

#[cfg(target_os = "windows")]
pub mod windows;
#[cfg(target_os = "windows")]
pub use self::windows as platform;

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "linux")]
pub use self::linux as platform;

pub const CWD_MARKER: &str = "__DWETERM_CWD__";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitInfo {
    pub branch: Option<String>,
    pub dirty: u32,
    pub ahead: u32,
    pub behind: u32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ShellInfo {
    pub app_version: String,
    pub shell_name: String,
    pub shell_key: String,
    pub shell_version: String,
    pub path_separator: String,
    pub cwd: String,
    pub home_dir: Option<String>,
    pub git: Option<GitInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub cwd: String,
    pub duration_ms: u64,
    pub shell_info: ShellInfo,
}

pub struct RunOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub next_cwd: Option<PathBuf>,
}

/// Strip the trailing `CWD_MARKER<path>` line from stdout and return the
/// cleaned stdout plus the parsed cwd (if present). Each platform script
/// appends this marker so the host can track `cd` between command runs.
pub fn split_stdout_and_cwd(stdout: String) -> (String, Option<PathBuf>) {
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
