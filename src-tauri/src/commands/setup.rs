use crate::shell::{run30, sanitize};
use serde_json::{json, Value};
use std::path::PathBuf;

fn project_root() -> PathBuf {
    // In the desktop build there is no project tree; report the current dir.
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[tauri::command]
pub async fn setup_status() -> Result<Value, String> {
    let (node_r, npm_r, python_r, pip_r) = tokio::join!(
        run30("node --version 2>/dev/null || echo 'NOT_FOUND'"),
        run30("npm --version 2>/dev/null || echo 'NOT_FOUND'"),
        run30("python3 --version 2>/dev/null || echo 'NOT_FOUND'"),
        run30("pip --version 2>/dev/null || echo 'NOT_FOUND'"),
    );

    Ok(json!({
        "node": {"found": node_r.stdout.trim() != "NOT_FOUND", "version": node_r.stdout.trim()},
        "npm": {"found": npm_r.stdout.trim() != "NOT_FOUND", "version": npm_r.stdout.trim()},
        "python": {"found": python_r.stdout.trim() != "NOT_FOUND", "version": python_r.stdout.trim()},
        "pip": {"found": pip_r.stdout.trim() != "NOT_FOUND", "version": pip_r.stdout.trim()},
        "npmModulesInstalled": false,
        "pipModulesInstalled": false,
        "projectRoot": project_root().display().to_string(),
    }))
}

#[tauri::command]
pub async fn setup_run(step: String) -> Result<Value, String> {
    if step != "npm" && step != "pip" {
        return Err("Invalid step. Use 'npm' or 'pip'".into());
    }
    let root = project_root();
    let command = if step == "npm" {
        format!("cd {} && npm install 2>&1", root.display())
    } else {
        format!("cd {} && pip install -r requirements-dev.txt 2>&1", root.display())
    };
    let result = crate::shell::run(&command, 300).await;
    Ok(json!({
        "command": command,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exit_code": result.exit_code,
    }))
}

// keep sanitize referenced
#[allow(dead_code)]
fn _s(s: &str) -> String {
    sanitize(s)
}
