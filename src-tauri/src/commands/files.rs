use crate::db::{log_action, Db};
use crate::shell::{run30, sanitize};
use base64::Engine;
use serde_json::{json, Value};
use std::path::Path;

fn audit(db: &Db, token: &Option<String>, action: &str, command: &str, code: i64) {
    log_action(
        db,
        &format!("FILE_{}", action.to_uppercase()),
        "files",
        Some(command),
        Some(json!({"exitCode": code})),
        token.as_deref().and_then(crate::commands::auth::audit_user),
    );
}

#[tauri::command]
pub async fn files_list(path: Option<String>) -> Result<Value, String> {
    let mut safe_path = sanitize(&path.unwrap_or_else(|| "/".into()));
    if !safe_path.starts_with('/') {
        safe_path = format!("/{safe_path}");
    }

    match tokio::fs::read_dir(&safe_path).await {
        Ok(mut entries) => {
            let mut files = Vec::new();
            while let Ok(Some(entry)) = entries.next_entry().await {
                let name = entry.file_name().to_string_lossy().to_string();
                // Skip entries we cannot stat (broken symlinks etc. still listed)
                let ft = entry.file_type().await;
                if let Ok(ft) = ft {
                    files.push(json!({
                        "name": name,
                        "isDirectory": ft.is_dir(),
                        "isFile": ft.is_file(),
                        "isSymlink": ft.is_symlink(),
                    }));
                }
            }
            files.sort_by(|a, b| {
                a["name"].as_str().cmp(&b["name"].as_str())
            });
            Ok(json!({"path": safe_path, "files": files}))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Err("Path not found".into()),
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => Err("Permission denied".into()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn files_manage(
    db: tauri::State<'_, Db>,
    token: Option<String>,
    body: Value,
) -> Result<Value, String> {
    let action = body.get("action").and_then(Value::as_str).unwrap_or("").to_string();
    let source = sanitize(body.get("source").and_then(Value::as_str).unwrap_or(""));
    let dest = sanitize(body.get("destination").and_then(Value::as_str).unwrap_or(""));

    if action == "write" {
        let content = body
            .get("content")
            .and_then(Value::as_str)
            .ok_or("Content required")?;
        return match tokio::fs::write(Path::new(&source), content).await {
            Ok(_) => {
                let cmd = format!("write {source}");
                audit(&db, &token, "write", &cmd, 0);
                Ok(json!({"command": cmd, "stdout": "File written", "stderr": "", "exit_code": 0}))
            }
            Err(e) => Err(e.to_string()),
        };
    }

    let command: String = match action.as_str() {
        "rename" | "move" => format!("sudo mv {source} {dest}"),
        "copy" => format!("sudo cp -r {source} {dest}"),
        "delete" => format!("sudo rm -rf {source}"),
        "chmod" => format!(
            "sudo chmod {} {source}",
            sanitize(&body.get("permissions").and_then(Value::as_str).unwrap_or(""))
        ),
        "chown" => format!(
            "sudo chown {} {source}",
            sanitize(&body.get("owner").and_then(Value::as_str).unwrap_or(""))
        ),
        "mkdir" => format!("sudo mkdir -p {source}"),
        _ => return Err("Invalid action".into()),
    };

    let result = run30(&command).await;
    audit(&db, &token, &action, &command, result.exit_code);
    Ok(json!({
        "command": command,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exit_code": result.exit_code,
    }))
}

#[tauri::command]
pub async fn files_upload(
    path: Option<String>,
    filename: String,
    content_b64: String,
) -> Result<Value, String> {
    let mut safe_path = sanitize(&path.unwrap_or_else(|| "/tmp".into()));
    if !safe_path.starts_with('/') {
        safe_path = format!("/{safe_path}");
    }
    let fname = sanitize(&filename);

    let data = base64::engine::general_purpose::STANDARD
        .decode(content_b64.trim())
        .map_err(|e| e.to_string())?;

    let dest = Path::new(&safe_path).join(&fname);
    tokio::fs::write(&dest, &data)
        .await
        .map_err(|e| e.to_string())?;

    Ok(json!({
        "command": format!("upload {fname} to {safe_path}"),
        "stdout": format!("Uploaded {fname} ({} bytes)", data.len()),
        "stderr": "",
        "exit_code": 0,
    }))
}

/// Replaces the old `window.open("/api/system/files?action=download...")` flow:
/// copies a server-side file into the user's Downloads folder.
#[tauri::command]
pub async fn files_download(path: String) -> Result<Value, String> {
    let safe_path = sanitize(&path);
    let src = Path::new(&safe_path);
    let file_name = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "download".into());

    let downloads = dirs::download_dir()
        .or_else(dirs::home_dir)
        .ok_or("Cannot resolve download directory")?;

    let mut dest = downloads.join(&file_name);
    let mut counter = 1u32;
    while dest.exists() {
        dest = downloads.join(format!("{counter}-{file_name}"));
        counter += 1;
    }

    tokio::fs::copy(src, &dest)
        .await
        .map_err(|e| format!("Download failed: {e}"))?;

    Ok(json!({
        "command": format!("download {safe_path}"),
        "stdout": format!("Saved to {}", dest.display()),
        "stderr": "",
        "exit_code": 0,
    }))
}
