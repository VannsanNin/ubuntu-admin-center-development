use crate::db::{log_action, Db};
use crate::shell::{run30, sanitize};
use serde_json::{json, Value};
use std::path::Path;

fn parse_repo_file(filename: &str, content: &str) -> Vec<Value> {
    let mut repos = Vec::new();
    for line in content.trim().lines() {
        let stripped = line.trim();
        if stripped.is_empty() {
            continue;
        }
        let mut is_repo = false;
        let mut enabled = true;
        let mut repo_text = stripped.to_string();

        if stripped.starts_with("deb ") || stripped.starts_with("deb-src ") {
            is_repo = true;
            enabled = true;
        } else if stripped.starts_with('#')
            && (stripped.contains("deb ") || stripped.contains("deb-src "))
        {
            let inner = stripped[1..].trim();
            if inner.starts_with("deb ") || inner.starts_with("deb-src ") {
                is_repo = true;
                enabled = false;
                repo_text = inner.to_string();
            }
        }

        if is_repo {
            repos.push(json!({
                "source": filename,
                "line": stripped,
                "enabled": enabled,
                "clean_line": repo_text,
            }));
        }
    }
    repos
}

#[tauri::command]
pub async fn repositories_get() -> Result<Value, String> {
    let sources_result =
        run30("cat /etc/apt/sources.list 2>/dev/null || echo 'File not found'").await;
    let sources_d_result = run30("ls /etc/apt/sources.list.d/ 2>/dev/null").await;

    let mut repos = parse_repo_file("sources.list", &sources_result.stdout);

    for filename in sources_d_result.stdout.trim().lines() {
        if !filename.is_empty() {
            let content_result =
                run30(&format!("cat /etc/apt/sources.list.d/{filename} 2>/dev/null || echo ''"))
                    .await;
            repos.extend(parse_repo_file(
                &format!("sources.list.d/{filename}"),
                &content_result.stdout,
            ));
        }
    }

    Ok(json!({ "repositories": repos }))
}

#[tauri::command]
pub async fn repositories_manage(
    db: tauri::State<'_, Db>,
    token: Option<String>,
    body: Value,
) -> Result<Value, String> {
    let action = body.get("action").and_then(Value::as_str).unwrap_or("").to_string();

    fn respond(command: String, stdout: &str, stderr: &str, exit_code: i64) -> Value {
        json!({
            "command": command,
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": exit_code,
        })
    }

    let result = match action.as_str() {
        "toggle" => {
            let source = body.get("source").and_then(Value::as_str).ok_or("source and line are required")?;
            let line = body.get("line").and_then(Value::as_str).ok_or("source and line are required")?;
            let enable = body.get("enable").and_then(Value::as_bool).unwrap_or(true);

            let safe_source = sanitize(source);
            let full_path = format!("/etc/apt/{safe_source}");

            let content = tokio::fs::read_to_string(&full_path)
                .await
                .map_err(|e| format!("Failed to read file: {e}"))?;

            if !content.contains(line) {
                return Err("Repository line not found in file".into());
            }

            let trimmed = line.trim_start_matches('#').trim();
            let new_line = if enable {
                trimmed
            } else {
                &format!("# {trimmed}")
            };
            let new_content = content.replace(line, new_line);

            // Write via sudo tee since /etc/apt is root-owned.
            use tokio::io::AsyncWriteExt;
            let mut child = tokio::process::Command::new("sudo")
                .arg("tee")
                .arg(&full_path)
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::null())
                .spawn()
                .map_err(|e| e.to_string())?;
            if let Some(mut stdin) = child.stdin.take() {
                stdin.write_all(new_content.as_bytes()).await.ok();
            }
            let status = child.wait().await.map_err(|e| e.to_string())?;

            let cmd = format!("toggle repo in {source}");
            log_action(
                &db,
                "REPO_TOGGLE",
                "repositories",
                Some(&cmd),
                Some(json!({"enable": enable})),
                token.as_deref().and_then(crate::commands::auth::audit_user),
            );
            if status.success() {
                respond(cmd, "Repository status updated", "", 0)
            } else {
                respond(cmd, "", "Failed to update repository file", 1)
            }
        }
        "test" => {
            let repo_line = body.get("repo").and_then(Value::as_str).unwrap_or("");
            let url = repo_line
                .split_whitespace()
                .find(|p| p.starts_with("http://") || p.starts_with("https://"))
                .ok_or("No URL found in repository line")?
                .to_string();

            let res = run30(&format!("curl -s -I -m 5 {url}")).await;
            if res.exit_code == 0 {
                respond(
                    format!("curl -I {url}"),
                    &format!("Repository {url} is online and available:\n{}", res.stdout),
                    "",
                    0,
                )
            } else {
                respond(
                    format!("curl -I {url}"),
                    "",
                    &format!("Repository {url} is unreachable:\n{}", res.stderr),
                    1,
                )
            }
        }
        "add" => {
            let repo_line = body.get("repo").and_then(Value::as_str).unwrap_or("").to_string();
            let filename = sanitize(&body.get("filename").and_then(Value::as_str).unwrap_or("custom"));
            use tokio::io::AsyncWriteExt;
            let path = format!("/etc/apt/sources.list.d/{filename}.list");
            let mut child = tokio::process::Command::new("sudo")
                .args(["tee", "-a", &path])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::null())
                .spawn()
                .map_err(|e| e.to_string())?;
            if let Some(mut stdin) = child.stdin.take() {
                stdin.write_all(repo_line.as_bytes()).await.ok();
                stdin.write_all(b"\n").await.ok();
            }
            let status = child.wait().await.map_err(|e| e.to_string())?;
            respond(format!("add {repo_line}"), "", "", if status.success() { 0 } else { 1 })
        }
        "remove" => {
            let filename = sanitize(&body.get("filename").and_then(Value::as_str).unwrap_or("custom"));
            let command = format!("sudo rm -f /etc/apt/sources.list.d/{filename}.list");
            let r = run30(&command).await;
            respond(command, &r.stdout, &r.stderr, r.exit_code)
        }
        "backup" => {
            let command = "sudo cp -r /etc/apt /etc/apt.backup.$(date +%Y%m%d%H%M%S)";
            let r = run30(command).await;
            respond(command.into(), &r.stdout, &r.stderr, r.exit_code)
        }
        "restore" => {
            let timestamp = sanitize(&body.get("timestamp").and_then(Value::as_str).unwrap_or(""));
            let command = format!(
                "sudo cp -r /etc/apt.backup.{timestamp}/* /etc/apt/ 2>/dev/null || echo 'Backup not found'"
            );
            let r = run30(&command).await;
            respond(command, &r.stdout, &r.stderr, r.exit_code)
        }
        _ => return Err("Invalid action".into()),
    };

    Ok(result)
}

/// Helper used by tests to check a path exists (keeps Path import meaningful).
pub fn _path_exists(p: &str) -> bool {
    Path::new(p).exists()
}
