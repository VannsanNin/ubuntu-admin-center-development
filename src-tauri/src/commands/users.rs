use crate::db::{log_action, Db};
use crate::shell::{run30, sanitize};
use serde_json::{json, Value};

fn audit(db: &Db, token: &Option<String>, action: &str, command: &str, code: i64) {
    log_action(
        db,
        &format!("USER_{}", action.to_uppercase()),
        "users",
        Some(command),
        Some(json!({"exitCode": code})),
        token.as_deref().and_then(crate::commands::auth::audit_user),
    );
}

#[tauri::command]
pub async fn users_get(action: Option<String>, username: Option<String>) -> Result<Value, String> {
    let action = action.unwrap_or_default();
    let username = username.unwrap_or_default();

    if action == "history" && !username.is_empty() {
        let u = sanitize(&username);
        let result = run30(&format!("last {u} | head -20")).await;
        return Ok(json!({"history": result.stdout}));
    }

    if action == "groups" && !username.is_empty() {
        let u = sanitize(&username);
        let result = run30(&format!("groups {u}")).await;
        return Ok(json!({"groups": result.stdout}));
    }

    let result = run30("getent passwd | cut -d: -f1,3,5,6,7").await;
    let users: Vec<Value> = result
        .stdout
        .trim()
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split(':').collect();
            (parts.len() >= 5).then(|| json!({
                "username": parts[0],
                "uid": parts[1],
                "fullName": parts[2],
                "home": parts[3],
                "shell": parts[4],
            }))
        })
        .collect();
    Ok(json!({"users": users}))
}

#[tauri::command]
pub async fn users_manage(
    db: tauri::State<'_, Db>,
    token: Option<String>,
    action: String,
    username: String,
    password: Option<String>,
    group: Option<String>,
) -> Result<Value, String> {
    let uname = sanitize(&username);
    let mut command: Option<String> = match action.as_str() {
        "create" => Some(format!("sudo useradd -m {uname}")),
        "delete" => Some(format!("sudo userdel -r {uname}")),
        "lock" => Some(format!("sudo usermod -L {uname}")),
        "unlock" => Some(format!("sudo usermod -U {uname}")),
        _ => None,
    };

    match action.as_str() {
        "resetPassword" => {
            let pw = password.ok_or("Password required")?;
            let pw = sanitize(&pw);
            command = Some(format!("echo '{uname}:{pw}' | sudo chpasswd"));
        }
        "addGroup" => {
            let g = sanitize(&group.ok_or("Group required")?);
            command = Some(format!("sudo usermod -aG {g} {uname}"));
        }
        "removeGroup" => {
            let g = sanitize(&group.ok_or("Group required")?);
            command = Some(format!("sudo gpasswd -d {uname} {g}"));
        }
        _ => {}
    }

    let command = command.ok_or("Invalid action")?;
    let result = run30(&command).await;
    audit(&db, &token, &action, &command, result.exit_code);
    Ok(json!({
        "command": command,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exit_code": result.exit_code,
    }))
}
