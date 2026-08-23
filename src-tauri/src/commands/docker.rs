use crate::db::{log_action, Db};
use crate::shell::{run, sanitize};
use serde_json::{json, Value};

async fn parse_docker_json(cmd: &str) -> Vec<Value> {
    let result = run30_quiet(cmd).await;
    result
        .stdout
        .trim()
        .lines()
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect()
}

async fn run30_quiet(cmd: &str) -> crate::shell::CmdResult {
    run(cmd, 30).await
}

#[tauri::command]
pub async fn docker_get(action: Option<String>, name: Option<String>) -> Result<Value, String> {
    let action = action.unwrap_or_default();
    let name = name.unwrap_or_default();

    if action == "images" {
        let images = parse_docker_json("docker images --format '{{json .}}' 2>/dev/null").await;
        return Ok(json!({ "images": images }));
    }

    if action == "stats" && !name.is_empty() {
        let n = sanitize(&name);
        let result = run(
            &format!("docker stats {n} --no-stream --format '{{{{json .}}}}'"),
            30,
        )
        .await;
        return match serde_json::from_str::<Value>(result.stdout.trim()) {
            Ok(stats) => Ok(json!({ "stats": stats })),
            Err(_) => Ok(json!({ "stats": result.stdout })),
        };
    }

    let containers =
        parse_docker_json("docker ps -a --format '{{json .}}' 2>/dev/null").await;
    Ok(json!({ "containers": containers }))
}

#[tauri::command]
pub async fn docker_manage(
    db: tauri::State<'_, Db>,
    token: Option<String>,
    body: Value,
) -> Result<Value, String> {
    let action = body.get("action").and_then(Value::as_str).unwrap_or("").to_string();
    let container = sanitize(&body.get("container").and_then(Value::as_str).unwrap_or(""));
    let image = sanitize(&body.get("image").and_then(Value::as_str).unwrap_or(""));

    let command: String = match action.as_str() {
        "create" => {
            let mut cmd = format!(
                "docker run -d --name {}",
                sanitize(&body.get("containerName").and_then(Value::as_str).unwrap_or(""))
            );
            let ports = sanitize(&body.get("ports").and_then(Value::as_str).unwrap_or(""));
            for p in ports.split(',').map(str::trim).filter(|s| !s.is_empty()) {
                cmd += &format!(" -p {p}");
            }
            let env = sanitize(&body.get("env").and_then(Value::as_str).unwrap_or(""));
            for e in env.split(',').map(str::trim).filter(|s| !s.is_empty()) {
                cmd += &format!(" -e {e}");
            }
            cmd += &format!(" {image}");
            cmd
        }
        "composeUp" => {
            if !body
                .get("composeContent")
                .and_then(Value::as_str)
                .unwrap_or("")
                .is_empty()
            {
                tokio::fs::write("/tmp/docker-compose.yml", compose_content(&body))
                    .await
                    .map_err(|e| e.to_string())?;
                "docker compose -f /tmp/docker-compose.yml up -d".into()
            } else {
                format!(
                    "docker compose -f {} up -d",
                    sanitize(&file_arg(&body))
                )
            }
        }
        "composeDown" => {
            if !compose_content(&body).is_empty() {
                "docker compose -f /tmp/docker-compose.yml down".into()
            } else {
                format!("docker compose -f {} down", sanitize(&file_arg(&body)))
            }
        }
        "composeLogs" => format!(
            "docker compose -f {} logs --tail 100",
            sanitize(&file_arg(&body))
        ),
        "stats" => {
            let c = sanitize(&body.get("container").and_then(Value::as_str).unwrap_or(""));
            format!("docker stats {c} --no-stream --format '{{{{.Name}}}}:{{{{.CPUPerc}}}}:{{{{.MemUsage}}}}:{{{{.MemPerc}}}}:{{{{.NetIO}}}}:{{{{.BlockIO}}}}'")
        }
        _ => {
            match action.as_str() {
                "start" => format!("docker start {container}"),
                "stop" => format!("docker stop {container}"),
                "restart" => format!("docker restart {container}"),
                "remove" => format!("docker rm -f {container}"),
                "pull" => format!("docker pull {image}"),
                "removeImage" => format!("docker rmi -f {image}"),
                "logs" => format!("docker logs --tail 100 {container}"),
                _ => return Err("Invalid action".into()),
            }
        }
    };

    let result = run(&command, 120).await;
    log_action(
        &db,
        &format!("DOCKER_{}", action.to_uppercase()),
        "docker",
        Some(&command),
        Some(json!({"exitCode": result.exit_code})),
        token.as_deref().and_then(crate::commands::auth::audit_user),
    );

    // Mirror the Python behavior of returning parsed stats for action=stats
    if action == "stats" {
        let parts: Vec<&str> = result.stdout.trim().split(':').collect();
        if parts.len() == 6 {
            return Ok(json!({
                "command": command,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
                "parsed": {
                    "name": parts[0],
                    "cpuPercent": parts[1],
                    "memUsage": parts[2],
                    "memPercent": parts[3],
                    "netIO": parts[4],
                    "blockIO": parts[5],
                },
            }));
        }
    }

    Ok(json!({
        "command": command,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exit_code": result.exit_code,
    }))
}

fn compose_content(body: &Value) -> &str {
    body.get("composeContent").and_then(Value::as_str).unwrap_or("")
}

fn file_arg(body: &Value) -> String {
    body.get("file")
        .and_then(Value::as_str)
        .unwrap_or("docker-compose.yml")
        .to_string()
}
