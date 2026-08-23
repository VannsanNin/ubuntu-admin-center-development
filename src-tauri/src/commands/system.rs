use crate::shell::{run, run30};
use serde_json::{json, Value};

fn probe_amd_gpu() -> Option<Value> {
    let entries = std::fs::read_dir("/sys/class/drm").ok()?;
    for entry in entries.flatten() {
        let fname = entry.file_name();
        let fname = fname.to_string_lossy();
        if !fname.starts_with("card") {
            continue;
        }
        let dev = entry.path().join("device");
        let Ok(busy) = std::fs::read_to_string(dev.join("gpu_busy_percent")) else {
            continue;
        };
        let Ok(usage) = busy.trim().parse::<u64>() else {
            continue;
        };
        let mb = |f: &str| -> u64 {
            std::fs::read_to_string(dev.join(f))
                .ok()
                .and_then(|s| s.trim().parse::<u64>().ok())
                .unwrap_or(0)
                / (1024 * 1024)
        };
        return Some(json!({
            "name": "AMD Radeon (iGPU)",
            "usage": usage,
            "memUsed": mb("mem_info_vram_used"),
            "memTotal": mb("mem_info_vram_total"),
            "temp": serde_json::Value::Null,
        }));
    }
    None
}

fn parse_nvidia(out: &str) -> Vec<Value> {
    out.trim()
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split(',').map(|p| p.trim()).collect();
            if parts.len() < 5 {
                return None;
            }
            Some(json!({
                "name": parts[0].trim_start_matches("NVIDIA GeForce "),
                "usage": parts[1].parse::<u64>().unwrap_or(0),
                "memUsed": parts[2].parse::<u64>().unwrap_or(0),
                "memTotal": parts[3].parse::<u64>().unwrap_or(0),
                "temp": parts[4].parse::<u64>().unwrap_or(0),
            }))
        })
        .collect()
}

async fn stats_snapshot() -> Value {
    let (cpu_r, mem_r, loadavg_r, procs_r, net_r, nvidia_r) = tokio::join!(
        run30("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1"),
        run30("free -m | grep Mem"),
        run30("cat /proc/loadavg"),
        run30("ps aux --no-headers | wc -l"),
        run30("cat /proc/net/dev | tail -n +3"),
        run30("nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null"),
    );
    let mem_parts: Vec<&str> = mem_r.stdout.trim().split_whitespace().collect();
    let mem_total: i64 = mem_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    let mem_used: i64 = mem_parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);
    let mut net_rx: u64 = 0;
    let mut net_tx: u64 = 0;
    for line in net_r.stdout.trim().lines() {
        if line.contains(':') {
            let mut it = line.trim().split(':');
            let iface = it.next().unwrap_or("").trim();
            let nums: Vec<&str> = it.next().unwrap_or("").split_whitespace().collect();
            if iface == "lo" || nums.len() < 10 {
                continue;
            }
            net_rx += nums[0].parse::<u64>().unwrap_or(0);
            net_tx += nums[8].parse::<u64>().unwrap_or(0);
        }
    }
    let mut gpus = parse_nvidia(&nvidia_r.stdout);
    if let Some(amd) = probe_amd_gpu() {
        gpus.push(amd);
    }
    json!({
        "cpuUsage": if cpu_r.stdout.trim().is_empty() { "0".into() } else { cpu_r.stdout.trim() },
        "memory": {
            "total": mem_total.to_string(),
            "used": mem_used.to_string(),
            "percentage": if mem_total > 0 { ((mem_used as f64 / mem_total as f64) * 100.0).round() } else { 0.0 },
        },
        "loadAverage": loadavg_r.stdout.split_whitespace().take(3).collect::<Vec<_>>(),
        "processCount": procs_r.stdout.trim().parse::<i64>().unwrap_or(0),
        "network": { "rx": net_rx.to_string(), "tx": net_tx.to_string() },
        "gpus": gpus,
    })
}

#[tauri::command]
pub async fn system_info() -> Result<Value, String> {
    let (
        hostname_r,
        version_r,
        kernel_r,
        uptime_r,
        loadavg_r,
        cpu_r,
        mem_r,
        swap_r,
        disk_r,
        net_r,
        users_r,
        procs_r,
        temp_r,
    ) = tokio::join!(
        run30("hostname"),
        run("lsb_release -ds 2>/dev/null || . /etc/os-release && echo $PRETTY_NAME", 10),
        run30("uname -r"),
        run30("uptime -p"),
        run30("cat /proc/loadavg"),
        run30("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1"),
        run30("free -m | grep Mem"),
        run30("free -m | grep Swap"),
        run30("df -h / | tail -1"),
        run30("cat /proc/net/dev | tail -n +3"),
        run30("who"),
        run30("ps aux --no-headers | wc -l"),
        run30("cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null || echo N/A"),
    );

    let mem_parts: Vec<&str> = mem_r.stdout.trim().split_whitespace().collect();
    let swap_parts: Vec<&str> = swap_r.stdout.trim().split_whitespace().collect();
    let disk_parts: Vec<&str> = disk_r.stdout.trim().split_whitespace().collect();

    let mut network_interfaces = Vec::new();
    for line in net_r.stdout.trim().lines() {
        let parts: Vec<&str> = line.trim().split_whitespace().collect();
        if parts.len() >= 10 {
            network_interfaces.push(json!({
                "interface": parts[0].replace(':', ""),
                "rx": parts[1],
                "tx": parts[9],
            }));
        }
    }

    let mut temps = Vec::new();
    for t in temp_r.stdout.trim().lines() {
        if t != "N/A" {
            if let Ok(v) = t.parse::<f64>() {
                temps.push(format!("{:.1}", v / 1000.0));
            }
        }
    }

    let mut logged_in_users = Vec::new();
    for line in users_r.stdout.trim().lines() {
        if !line.is_empty() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            logged_in_users.push(json!({
                "user": parts.first().unwrap_or(&""),
                "tty": parts.get(1).unwrap_or(&""),
                "from": parts.get(2).unwrap_or(&""),
            }));
        }
    }

    let mem_total: i64 = mem_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    let mem_used: i64 = mem_parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);

    Ok(json!({
        "hostname": hostname_r.stdout.trim(),
        "version": version_r.stdout.trim().trim_matches('"'),
        "kernel": kernel_r.stdout.trim(),
        "uptime": uptime_r.stdout.trim(),
        "loadAverage": loadavg_r.stdout.split_whitespace().take(3).collect::<Vec<_>>(),
        "cpuUsage": if cpu_r.stdout.trim().is_empty() { "0".into() } else { cpu_r.stdout.trim() },
        "memory": {
            "total": mem_total.to_string(),
            "used": mem_used.to_string(),
            "free": mem_parts.get(3).copied().unwrap_or("0"),
            "percentage": if mem_total > 0 { ((mem_used as f64 / mem_total as f64) * 100.0).round() } else { 0.0 },
        },
        "swap": {
            "total": swap_parts.get(1).copied().unwrap_or("0"),
            "used": swap_parts.get(2).copied().unwrap_or("0"),
            "free": swap_parts.get(3).copied().unwrap_or("0"),
        },
        "disk": {
            "total": disk_parts.get(1).copied().unwrap_or("0"),
            "used": disk_parts.get(2).copied().unwrap_or("0"),
            "free": disk_parts.get(3).copied().unwrap_or("0"),
            "percentage": disk_parts.get(4).copied().unwrap_or("0%"),
        },
        "network": network_interfaces,
        "loggedInUsers": logged_in_users,
        "processCount": procs_r.stdout.trim().parse::<i64>().unwrap_or(0),
        "temperatures": if temps.is_empty() { vec!["N/A"] } else { temps.iter().map(|s| s.as_str()).collect() },
    }))
}

/// Internal helper reused by the stats stream.
pub async fn snapshot() -> Value {
    stats_snapshot().await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_snapshot_has_data() {
        let snap = stats_snapshot().await;
        println!("SNAPSHOT: {snap}");
        assert!(snap["cpuUsage"].as_str().unwrap() != "0", "cpuUsage is 0");
        assert!(snap["memory"]["total"].as_str().unwrap() != "0", "mem total is 0");
        assert!(snap["processCount"].as_i64().unwrap() > 0, "processCount is 0");
    }

    #[tokio::test]
    async fn test_system_info_has_data() {
        let info = system_info().await.unwrap();
        println!("INFO: {info}");
        assert!(!info["hostname"].as_str().unwrap().is_empty(), "hostname empty");
        assert!(info["memory"]["total"].as_str().unwrap() != "0", "mem total is 0");
        assert!(info["disk"]["percentage"].as_str().unwrap() != "0%", "disk pct is 0%");
    }
}
