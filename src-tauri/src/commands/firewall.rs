use crate::db::{log_action, Db};
use crate::shell::{run30, sanitize};
use serde_json::{json, Value};

#[tauri::command]
pub async fn firewall_get() -> Result<Value, String> {
    let result = run30("sudo ufw status numbered").await;

    let mut rules = Vec::new();
    for line in result.stdout.trim().lines() {
        let line = line.trim();
        if line.is_empty() || !line.chars().next().is_some_and(|c| c.is_ascii_digit()) {
            continue;
        }
        let Some(bracket_end) = line.find("] ") else { continue };
        let inner = &line[..bracket_end];
        let num_str: String = inner
            .chars()
            .filter(|c| c.is_ascii_digit())
            .collect();
        if let Ok(num) = num_str.parse::<i64>() {
            rules.push(json!({
                "number": num,
                "line": line[bracket_end + 2..].trim(),
            }));
        }
    }

    Ok(json!({
        "status": if result.stdout.contains("Status: active") { "active" } else { "inactive" },
        "rules": rules,
        "raw": result.stdout,
    }))
}

#[tauri::command]
pub async fn firewall_manage(
    db: tauri::State<'_, Db>,
    token: Option<String>,
    action: String,
    port: Option<String>,
    protocol: Option<String>,
    from_addr: Option<String>,
) -> Result<Value, String> {
    let protocol = protocol.unwrap_or_else(|| "tcp".into());
    let mut command: Option<String> = match action.as_str() {
        "enable" => Some("sudo ufw --force enable".into()),
        "disable" => Some("sudo ufw disable".into()),
        "reset" => Some("sudo ufw --force reset".into()),
        _ => None,
    };

    match action.as_str() {
        "allow" | "deny" => {
            let p = sanitize(&port.clone().ok_or("Port required")?);
            let verb = if action == "allow" { "allow" } else { "deny" };
            let mut cmd = format!("sudo ufw {verb} {p}/{protocol}");
            if let Some(f) = from_addr.as_deref().filter(|s| !s.is_empty()) {
                cmd += &format!(" from {}", sanitize(f));
            }
            command = Some(cmd);
        }
        "delete" => {
            let p = sanitize(&port.ok_or("Rule required")?);
            command = Some(if p.chars().all(|c| c.is_ascii_digit()) {
                format!("sudo ufw --force delete {p}")
            } else {
                format!("sudo ufw delete allow {p}/{protocol}")
            });
        }
        _ => {}
    }

    let command = command.ok_or("Invalid action")?;
    let result = run30(&command).await;
    log_action(
        &db,
        &format!("FIREWALL_{}", action.to_uppercase()),
        "firewall",
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
