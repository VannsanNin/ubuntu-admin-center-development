use crate::shell::{run, run30, sanitize};
use serde_json::{json, Value};

#[tauri::command]
pub async fn network_get(action: Option<String>, target: Option<String>) -> Result<Value, String> {
    let action = action.unwrap_or_default();
    let target = sanitize(&target.unwrap_or_default());

    if action == "ping" && !target.is_empty() {
        let result = run30(&format!("ping -c 4 {target} 2>&1 || ping -c 4 {target}")).await;
        return Ok(json!({"output": format!("{}{}", result.stdout, result.stderr)}));
    }

    if action == "traceroute" && !target.is_empty() {
        let result = run30(&format!(
            "traceroute -m 15 {target} 2>&1 || echo 'traceroute not installed'"
        ))
        .await;
        return Ok(json!({"output": format!("{}{}", result.stdout, result.stderr)}));
    }

    if action == "speedtest" {
        let result = run(
            "curl -s https://raw.githubusercontent.com/sivel/speedtest-cli/master/speedtest.py 2>/dev/null | python3 - 2>&1 || echo 'Speed test unavailable'",
            90,
        )
        .await;
        return Ok(json!({"output": format!("{}{}", result.stdout, result.stderr)}));
    }

    let (ip_r, gateway_r, dns_r, interfaces_r, ports_r) = tokio::join!(
        run30("hostname -I 2>/dev/null || ip addr show | grep 'inet ' | awk '{print $2}'"),
        run30("ip route | grep default | awk '{print $3}'"),
        run30("cat /etc/resolv.conf | grep nameserver | awk '{print $2}'"),
        run30("ip -br addr show 2>/dev/null || ifconfig"),
        run30("ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null"),
    );

    let ports: Vec<Value> = ports_r
        .stdout
        .trim()
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.trim().split_whitespace().collect();
            (parts.len() >= 4).then(|| {
                json!({
                    "state": if line.contains("LISTEN") { "LISTEN" } else { "UNKNOWN" },
                    "local": parts.get(3).copied().unwrap_or(""),
                    "process": if parts.len() > 6 { parts[6..].join(" ") } else { String::new() },
                })
            })
        })
        .collect();

    let interfaces: Vec<Value> = interfaces_r
        .stdout
        .trim()
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.trim().split_whitespace().collect();
            (parts.len() >= 2).then(|| json!({
                "name": parts[0],
                "state": parts.get(1).copied().unwrap_or("unknown"),
            }))
        })
        .collect();

    Ok(json!({
        "ipAddresses": ip_r.stdout.split_whitespace().collect::<Vec<_>>(),
        "gateway": gateway_r.stdout.trim(),
        "dns": dns_r.stdout.split_whitespace().collect::<Vec<_>>(),
        "interfaces": interfaces,
        "ports": ports,
    }))
}
