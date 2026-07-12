#![allow(dead_code)]
use tokio::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

pub async fn run_command(cmd: &str, args: &[&str]) -> CommandResult {
    let output = Command::new(cmd)
        .args(args)
        .output()
        .await;

    match output {
        Ok(o) => CommandResult {
            command: format!("{} {}", cmd, args.join(" ")),
            stdout: String::from_utf8_lossy(&o.stdout).to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).to_string(),
            exit_code: o.status.code().unwrap_or(-1),
        },
        Err(e) => CommandResult {
            command: format!("{} {}", cmd, args.join(" ")),
            stdout: String::new(),
            stderr: format!("Failed to execute: {}", e),
            exit_code: -1,
        },
    }
}

pub async fn run_shell(cmd: &str) -> CommandResult {
    let output = Command::new("sh")
        .arg("-c")
        .arg(cmd)
        .output()
        .await;

    match output {
        Ok(o) => CommandResult {
            command: cmd.to_string(),
            stdout: String::from_utf8_lossy(&o.stdout).to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).to_string(),
            exit_code: o.status.code().unwrap_or(-1),
        },
        Err(e) => CommandResult {
            command: cmd.to_string(),
            stdout: String::new(),
            stderr: format!("Failed to execute: {}", e),
            exit_code: -1,
        },
    }
}

pub fn sanitize_input(input: &str) -> String {
    input.chars()
        .filter(|c| !matches!(c, ';' | '&' | '|' | '<' | '>' | '$' | '`' | '\'' | '"' | '(' | ')' | '[' | ']' | '{' | '}' | '\\'))
        .collect()
}

pub fn sanitize_path(input: &str) -> String {
    input.chars()
        .filter(|c| !matches!(c, ';' | '&' | '|' | '<' | '>' | '$' | '`' | '\'' | '"' | '\\'))
        .collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub hostname: String,
    pub os_version: String,
    pub kernel: String,
    pub uptime: String,
    pub cpu_usage: f64,
    pub cpu_cores: Vec<f64>,
    pub load_average: Vec<String>,
    pub memory: MemoryInfo,
    pub swap: MemoryInfo,
    pub disk: DiskInfo,
    pub network: Vec<NetworkInterface>,
    pub logged_in_users: Vec<String>,
    pub process_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryInfo {
    pub total_mb: u64,
    pub used_mb: u64,
    pub free_mb: u64,
    pub percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub total: String,
    pub used: String,
    pub available: String,
    pub percent: f64,
    pub mount_point: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Process {
    pub pid: u32,
    pub user: String,
    pub cpu: f64,
    pub mem: f64,
    pub vsz: String,
    pub rss: String,
    pub tty: String,
    pub stat: String,
    pub start: String,
    pub time: String,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub name: String,
    pub active: String,
    pub sub: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub username: String,
    pub uid: String,
    pub gid: String,
    pub home: String,
    pub shell: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirewallRule {
    pub number: String,
    pub policy: String,
    pub action: String,
    pub source: String,
    pub destination: String,
    pub port: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskPartition {
    pub filesystem: String,
    pub total: String,
    pub used: String,
    pub available: String,
    pub percent: f64,
    pub mount_point: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerContainer {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub ports: String,
    pub created: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerImage {
    pub id: String,
    pub repository: String,
    pub tag: String,
    pub size: String,
    pub created: String,
}

async fn read_per_core_cpu() -> Vec<f64> {
    let stat = run_shell("head -20 /proc/stat").await.stdout;
    let mut cores = Vec::new();
    for line in stat.lines() {
        if line.starts_with("cpu") && !line.starts_with("cpu ") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 5 {
                let user: u64 = parts[1].parse().unwrap_or(0);
                let nice: u64 = parts[2].parse().unwrap_or(0);
                let system: u64 = parts[3].parse().unwrap_or(0);
                let idle: u64 = parts[4].parse().unwrap_or(0);
                let total = user + nice + system + idle;
                let busy = user + nice + system;
                let usage = if total > 0 { busy as f64 / total as f64 * 100.0 } else { 0.0 };
                cores.push(usage);
            }
        }
    }
    cores
}

impl SystemInfo {
    pub async fn collect() -> Self {
        let hostname = run_command("hostname", &[]).await.stdout.trim().to_string();
        let os = run_shell("lsb_release -ds 2>/dev/null || cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'").await.stdout.trim().to_string();
        let kernel = run_command("uname", &["-r"]).await.stdout.trim().to_string();
        let uptime = run_command("uptime", &["-p"]).await.stdout.trim().to_string();
        let cpu_str = run_shell(r#"top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print $2}'"#).await.stdout.trim().to_string();
        let cpu_usage: f64 = cpu_str.parse().unwrap_or(0.0);

        let cpu_cores = read_per_core_cpu().await;
        let load_raw = run_shell("cat /proc/loadavg").await.stdout;
        let load_parts: Vec<&str> = load_raw.split_whitespace().collect();
        let load_average = load_parts.iter().take(3).map(|s| s.to_string()).collect();

        let mem_out = run_shell(r#"free -m | grep Mem | awk '{print $2,$3,$4}'"#).await.stdout;
        let mem_parts: Vec<&str> = mem_out.split_whitespace().collect();
        let mem_total: u64 = mem_parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
        let mem_used: u64 = mem_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
        let mem_free: u64 = mem_parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);
        let mem_percent = if mem_total > 0 { (mem_used as f64 / mem_total as f64) * 100.0 } else { 0.0 };

        let swap_out = run_shell(r#"free -m | grep Swap | awk '{print $2,$3,$4}'"#).await.stdout;
        let swap_parts: Vec<&str> = swap_out.split_whitespace().collect();
        let swap_total: u64 = swap_parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
        let swap_used: u64 = swap_parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
        let swap_free: u64 = swap_parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);
        let swap_percent = if swap_total > 0 { (swap_used as f64 / swap_total as f64) * 100.0 } else { 0.0 };

        let disk_out = run_shell(r#"df -h / | tail -1 | awk '{print $2,$3,$4,$5,$6}'"#).await.stdout;
        let disk_parts: Vec<&str> = disk_out.split_whitespace().collect();
        let disk_percent_str = disk_parts.get(3).unwrap_or(&"0%").trim_end_matches('%');
        let disk_percent: f64 = disk_percent_str.parse().unwrap_or(0.0);

        let net_out = run_shell(r#"cat /proc/net/dev | tail -n +3 | awk '{print $1,$2,$10}'"#).await.stdout;
        let mut network = Vec::new();
        for line in net_out.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let name = parts[0].trim_end_matches(':');
                if name == "lo" { continue; }
                let rx: u64 = parts[1].parse().unwrap_or(0);
                let tx: u64 = parts[2].parse().unwrap_or(0);
                network.push(NetworkInterface { name: name.to_string(), rx_bytes: rx, tx_bytes: tx });
            }
        }

        let users_out = run_shell("who | awk '{print $1}'").await.stdout;
        let logged_in_users: Vec<String> = users_out.lines().map(|s| s.to_string()).collect();

        let proc_count = run_shell("ps aux --no-headers 2>/dev/null | wc -l").await.stdout.trim().parse().unwrap_or(0);

        SystemInfo {
            hostname, os_version: os, kernel, uptime,
            cpu_usage, cpu_cores, load_average,
            memory: MemoryInfo { total_mb: mem_total, used_mb: mem_used, free_mb: mem_free, percent: mem_percent },
            swap: MemoryInfo { total_mb: swap_total, used_mb: swap_used, free_mb: swap_free, percent: swap_percent },
            disk: DiskInfo {
                total: disk_parts.first().unwrap_or(&"0").to_string(),
                used: disk_parts.get(1).unwrap_or(&"0").to_string(),
                available: disk_parts.get(2).unwrap_or(&"0").to_string(),
                percent: disk_percent,
                mount_point: disk_parts.get(4).unwrap_or(&"/").to_string(),
            },
            network,
            logged_in_users,
            process_count: proc_count,
        }
    }
}
