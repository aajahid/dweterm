use std::path::Path;
use std::process::Command;

use super::GitInfo;

pub fn collect_git_info(cwd: &Path) -> Option<GitInfo> {
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
