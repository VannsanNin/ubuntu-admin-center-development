use crate::shell::{run30, sanitize};
use serde_json::{json, Value};

const LOG_PATHS: &[(&str, &str)] = &[
    ("syslog", "/var/log/syslog"),
    ("auth", "/var/log/auth.log"),
    ("kern", "/var/log/kern.log"),
    ("dmesg", "/var/log/dmesg"),
    ("docker", "/var/log/docker.log"),
    ("nginx", "/var/log/nginx/access.log"),
    ("nginxError", "/var/log/nginx/error.log"),
    ("apache", "/var/log/apache2/access.log"),
    ("apacheError", "/var/log/apache2/error.log"),
];

#[tauri::command]
pub async fn logs_get(
    log_type: Option<String>,
    lines: Option<i64>,
    search: Option<String>,
) -> Result<Value, String> {
    let log_type = log_type.unwrap_or_else(|| "syslog".into());
    let lines = lines.unwrap_or(100).clamp(1, 10000);
    let search = search.unwrap_or_default();

    let log_path = LOG_PATHS
        .iter()
        .find(|(k, _)| *k == log_type)
        .map(|(_, v)| *v)
        .unwrap_or("/var/log/syslog");

    let grep_cmd = if search.is_empty() {
        String::new()
    } else {
        format!(" | grep -i '{}'", sanitize(&search))
    };
    let command = format!("tail -n {lines} {log_path}{grep_cmd}");

    let result = run30(&command).await;
    let raw = if result.stdout.trim().is_empty() && result.exit_code != 0 {
        "Log file not found or unreadable (try: sudo usermod -aG adm $USER)".to_string()
    } else {
        result.stdout.clone()
    };

    let log_lines: Vec<Value> = raw
        .trim()
        .lines()
        .map(|line| {
            let lower = line.to_lowercase();
            let line_type = if ["error", "critical", "panic", "alert"]
                .iter()
                .any(|w| lower.contains(w))
            {
                "error"
            } else if ["warning", "warn"].iter().any(|w| lower.contains(w)) {
                "warning"
            } else {
                "normal"
            };
            json!({"text": line, "type": line_type})
        })
        .collect();

    Ok(json!({"lines": log_lines, "raw": raw}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_logs_syslog() {
        let r = logs_get(Some("syslog".into()), Some(20), None).await.unwrap();
        println!("LINES: {}", r["lines"].as_array().map(|a| a.len()).unwrap_or(0));
        println!("FIRST: {}", r["raw"].as_str().unwrap_or("").lines().next().unwrap_or("<empty>"));
    }

    #[tokio::test]
    async fn test_logs_dmesg() {
        let r = logs_get(Some("dmesg".into()), Some(10), None).await.unwrap();
        println!("DMESG RAW: {:?}", r["raw"].as_str().unwrap_or("").chars().take(120).collect::<String>());
    }
}
