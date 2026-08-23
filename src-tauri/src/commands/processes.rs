use crate::db::{log_action, Db};
use crate::shell::{run30, sanitize};
use serde_json::{json, Value};

#[tauri::command]
pub async fn processes_get(sort: Option<String>, search: Option<String>) -> Result<Value, String> {
    let sort = sort.unwrap_or_else(|| "cpu".into());
    let search = search.unwrap_or_default();

    let mut cmd = "ps aux --no-headers".to_string();
    match sort.as_str() {
        "cpu" => cmd += " --sort=-%cpu",
        "mem" => cmd += " --sort=-%mem",
        _ => {}
    }

    let result = run30(&cmd).await;
    let mut processes: Vec<Value> = result
        .stdout
        .trim()
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.trim().split_whitespace().collect();
            (parts.len() >= 11).then(|| {
                json!({
                    "user": parts[0],
                    "pid": parts[1].parse::<i64>().unwrap_or(0),
                    "cpu": parts[2].parse::<f64>().unwrap_or(0.0),
                    "mem": parts[3].parse::<f64>().unwrap_or(0.0),
                    "vsz": parts[4],
                    "rss": parts[5],
                    "tty": parts[6],
                    "stat": parts[7],
                    "start": parts[8],
                    "time": parts[9],
                    "command": parts[10..].join(" "),
                })
            })
        })
        .collect();

    if !search.is_empty() {
        let s = search.to_lowercase();
        processes.retain(|p| {
            let cmd_text = p["command"].as_str().unwrap_or("").to_lowercase();
            let user = p["user"].as_str().unwrap_or("").to_lowercase();
            cmd_text.contains(&s) || user.contains(&s)
        });
    }

    Ok(json!({"processes": processes}))
}

#[tauri::command]
pub async fn processes_manage(
    db: tauri::State<'_, Db>,
    token: Option<String>,
    pid: i64,
    signal: Option<String>,
) -> Result<Value, String> {
    let sig = sanitize(&signal.unwrap_or_else(|| "TERM".into()));
    let pid_s = pid.to_string(); // numeric only by construction
    let command = format!("sudo kill -{sig} {pid_s}");
    let result = run30(&command).await;
    log_action(
        &db,
        "KILL_PROCESS",
        "processes",
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
