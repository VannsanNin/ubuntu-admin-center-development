use crate::shell::{run30, sanitize};
use serde_json::{json, Value};

fn parse_items(stdout: &str) -> Vec<Value> {
    stdout
        .trim()
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| match line.split_once('\t') {
            Some((size, path)) => Some(json!({"size": size.trim(), "path": path.trim()})),
            None => None,
        })
        .collect()
}

#[tauri::command]
pub async fn disk_get(action: Option<String>, path: Option<String>) -> Result<Value, String> {
    let action = action.unwrap_or_default();
    let path = sanitize(&path.unwrap_or_else(|| "/".into()));

    if action == "largestFolders" {
        let result = run30(&format!("du -sh {path}/*/ 2>/dev/null | sort -rh | head -20")).await;
        return Ok(json!({"items": parse_items(&result.stdout)}));
    }

    if action == "largestFiles" {
        let cmd = format!(
            "find {path} -type f -exec du -sh {{}} \\; 2>/dev/null | sort -rh | head -20"
        );
        let result = run30(&cmd).await;
        return Ok(json!({"items": parse_items(&result.stdout)}));
    }

    let result = run30("df -h").await;
    let drives: Vec<Value> = result
        .stdout
        .trim()
        .lines()
        .skip(1)
        .filter_map(|line| {
            let parts: Vec<&str> = line.trim().split_whitespace().collect();
            (parts.len() >= 6).then(|| {
                json!({
                    "filesystem": parts[0],
                    "size": parts[1],
                    "used": parts[2],
                    "available": parts[3],
                    "usePercent": parts[4],
                    "mountedOn": parts[5],
                })
            })
        })
        .collect();
    Ok(json!({"drives": drives}))
}
