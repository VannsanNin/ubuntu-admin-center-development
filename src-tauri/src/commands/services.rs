use crate::db::{log_action, Db};
use crate::shell::{run30, sanitize};
use serde_json::{json, Value};

#[tauri::command]
pub async fn services_get(action: Option<String>, name: Option<String>) -> Result<Value, String> {
    let action = action.unwrap_or_default();
    let name = name.unwrap_or_default();

    if action == "status" && !name.is_empty() {
        let n = sanitize(&name);
        let result = run30(&format!("systemctl status {n} --no-pager")).await;
        return Ok(json!({"status": result.stdout, "stderr": result.stderr}));
    }

    if action == "logs" && !name.is_empty() {
        let n = sanitize(&name);
        let result = run30(&format!("journalctl -u {n} --no-pager -n 50")).await;
        return Ok(json!({"logs": result.stdout}));
    }

    let result = run30("systemctl list-units --type=service --no-pager --no-legend").await;
    let services: Vec<Value> = result
        .stdout
        .trim()
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.trim().split_whitespace().collect();
            (parts.len() >= 4).then(|| json!({
                "name": parts[0],
                "load": parts[1],
                "active": parts[2],
                "sub": parts[3],
                "description": parts[4..].join(" "),
            }))
        })
        .collect();
    Ok(json!({"services": services}))
}

#[tauri::command]
pub async fn services_manage(
    db: tauri::State<'_, Db>,
    token: Option<String>,
    action: String,
    service_name: String,
) -> Result<Value, String> {
    let svc = sanitize(&service_name);
    let command = match action.as_str() {
        "start" => format!("sudo systemctl start {svc}"),
        "stop" => format!("sudo systemctl stop {svc}"),
        "restart" => format!("sudo systemctl restart {svc}"),
        "reload" => format!("sudo systemctl reload {svc}"),
        "enable" => format!("sudo systemctl enable {svc}"),
        "disable" => format!("sudo systemctl disable {svc}"),
        _ => return Err("Invalid action".into()),
    };

    let result = run30(&command).await;
    log_action(
        &db,
        &format!("SERVICE_{}", action.to_uppercase()),
        "services",
        Some(&command),
        Some(json!({"exitCode": result.exit_code})),
        token.as_deref().and_then(crate::commands::auth::audit_user),
    );
    Ok(json!({
        "command": command,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exit_code": result.exit_code,
    }))
}
