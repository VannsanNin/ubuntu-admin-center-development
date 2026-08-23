use crate::commands::auth::audit_user;
use crate::db::{log_action, Db};
use crate::shell::{run, sanitize, run30};
use serde_json::{json, Value};
use std::collections::HashSet;

const CRITICAL_PACKAGES: &[&str] = &[
    "apt", "dpkg", "systemd", "systemd-sysv", "systemd-resolved",
    "bash", "coreutils", "util-linux", "mount", "ubuntu-minimal",
    "ubuntu-standard", "ubuntu-server", "linux-image-generic",
    "linux-headers-generic", "grub-pc", "grub-efi", "grub-common",
    "openssh-server", "openssh-client", "sudo", "adduser",
    "netplan.io", "networkd-dispatcher", "systemd-timesyncd",
    "ca-certificates", "tzdata", "locales", "init", "init-system-helpers",
    "libc6", "libssl3", "libsystemd0", "libpam-systemd",
    "dbus", "dbus-user-session", "policykit-1", "python3",
    "python3-minimal", "apt-utils", "login", "passwd",
    "udev", "procps", "grep", "sed", "gawk", "tar", "gzip",
    "perl-base", "findutils", "console-setup", "kmod",
    "e2fsprogs", "fdisk", "sysvinit-utils", "cron",
];

fn parse_dpkg_status(content: &str) -> Vec<Value> {
    let mut packages = Vec::new();
    let mut stanza: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    let flush = |stanza: &mut std::collections::HashMap<String, String>, packages: &mut Vec<Value>| {
        if stanza.is_empty() {
            return;
        }
        let status = stanza.get("status").map(|s| s.as_str()).unwrap_or("");
        let installed = status.contains("install ok installed");
        let not_installed = status.contains("not-installed");
        if !installed && !not_installed {
            stanza.clear();
            return;
        }
        let name = stanza.get("package").cloned().unwrap_or_default();
        if name.is_empty() {
            stanza.clear();
            return;
        }
        let desc_raw = stanza.get("description").cloned().unwrap_or_default();
        let desc_short = desc_raw.lines().next().unwrap_or("").trim().to_string();
        packages.push(json!({
            "status": if installed { "ii" } else { "un" },
            "name": name,
            "version": stanza.get("version").cloned().unwrap_or_default(),
            "architecture": stanza.get("architecture").cloned().unwrap_or_default(),
            "description": desc_short,
            "safe_to_remove": !CRITICAL_PACKAGES.contains(&name.as_str()),
        }));
        stanza.clear();
    };

    for line in content.lines() {
        if line.trim().is_empty() {
            flush(&mut stanza, &mut packages);
        } else if line.starts_with(' ') || line.starts_with('\t') {
            // continuation lines ignored
        } else {
            let (key, val) = match line.split_once(':') {
                Some((k, v)) => (k.to_lowercase(), v.trim().to_string()),
                None => continue,
            };
            stanza.insert(key, val);
        }
    }
    flush(&mut stanza, &mut packages);
    packages
}

pub async fn installed_packages() -> Vec<Value> {
    let content = match tokio::fs::read_to_string("/var/lib/dpkg/status").await {
        Ok(c) => c,
        Err(_) => {
            let result = run30("dpkg -l | tail -n +6").await;
            result.stdout
        }
    };
    parse_dpkg_status(&content)
}

#[tauri::command]
pub async fn packages_get(action: Option<String>, query: Option<String>) -> Result<Value, String> {
    let action = action.unwrap_or_else(|| "installed".into());
    let query = query.unwrap_or_default();

    if action == "installed" {
        return Ok(json!({ "packages": installed_packages().await }));
    }

    if action == "search" && !query.is_empty() {
        let q = sanitize(&query);
        let result = run30(&format!("apt-cache search {q}")).await;
        let packages: Vec<Value> = result
            .stdout
            .trim()
            .lines()
            .filter_map(|line| line.find(" - ").map(|idx| json!({
                "name": line[..idx].trim(),
                "description": line[idx + 3..].trim(),
            })))
            .collect();
        return Ok(json!({ "packages": packages }));
    }

    if action == "show" && !query.is_empty() {
        let q = sanitize(&query);
        let result = run30(&format!("apt-cache show {q}")).await;
        return Ok(json!({ "info": result.stdout }));
    }

    let result = run30("apt list --installed 2>/dev/null | head -50").await;
    Ok(json!({ "packages": result.stdout }))
}

async fn audit_and_run(db: &Db, token: &str, module: &str, command: &str, timeout: u64) -> Value {
    let result = run(command, timeout).await;
    log_action(
        db,
        "EXECUTE",
        module,
        Some(command),
        Some(json!({"exitCode": result.exit_code})),
        audit_user(token),
    );
    json!({
        "command": command,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exit_code": result.exit_code,
    })
}

#[tauri::command]
pub async fn packages_manage(
    db: tauri::State<'_, Db>,
    token: Option<String>,
    action: String,
    package_name: Option<String>,
) -> Result<Value, String> {
    let pkg = sanitize(package_name.as_deref().unwrap_or(""));
    let command = match action.as_str() {
        "update" => "sudo apt update".to_string(),
        "install" => format!("sudo apt install -y {pkg}"),
        "remove" => format!("sudo apt remove -y {pkg}"),
        "purge" => format!("sudo apt purge -y {pkg}"),
        "upgrade" => "sudo apt upgrade -y".to_string(),
        "autoremove" => "sudo apt autoremove -y".to_string(),
        _ => return Err("Invalid action".into()),
    };
    if matches!(action.as_str(), "install" | "remove" | "purge") && pkg.is_empty() {
        return Err("Package name required".into());
    }
    Ok(audit_and_run(&db, &token.unwrap_or_default(), "packages", &command, 120).await)
}

#[tauri::command]
pub async fn software_installer(
    db: tauri::State<'_, Db>,
    token: Option<String>,
    action: String,
    packages: Vec<String>,
) -> Result<Value, String> {
    let sanitized: Vec<String> = packages
        .iter()
        .map(|p| sanitize(p))
        .filter(|p| !p.is_empty())
        .collect();
    if sanitized.is_empty() {
        return Err("No valid packages".into());
    }
    let pkg_str = sanitized.join(" ");
    let command = if action == "install" {
        format!("sudo apt-get install -y {pkg_str}")
    } else {
        format!("sudo apt-get remove -y {pkg_str}")
    };
    Ok(audit_and_run(&db, &token.unwrap_or_default(), "software-installer", &command, 300).await)
}

#[tauri::command]
pub async fn software_installer_check(packages: Vec<String>) -> Result<Value, String> {
    if packages.is_empty() {
        return Err("Packages list required".into());
    }
    let sanitized: Vec<String> = packages.iter().map(|p| sanitize(p)).collect();
    let mut status = serde_json::Map::new();
    for pkg in sanitized {
        let check = run30(&format!(
            "dpkg -s {pkg} 2>/dev/null | grep -c 'Status: install ok installed'"
        ))
        .await;
        status.insert(pkg, Value::Bool(check.stdout.trim() == "1"));
    }
    Ok(json!({ "status": status }))
}

#[tauri::command]
pub async fn package_cleaner_analyze() -> Result<Value, String> {
    let (cache_size_r, disk_r, orphan_count_r, orphan_list_r, kernels_r, autoclean_r) = tokio::join!(
        run30("du -sh /var/cache/apt/archives/ 2>/dev/null | cut -f1 || echo '0'"),
        run30("df -h / | tail -1"),
        run30("apt-get -s autoremove 2>&1 | grep '^Remv' | wc -l"),
        run30("apt-get -s autoremove 2>&1 | grep '^Remv' | awk '{print $2}'"),
        run30("dpkg -l | grep '^ii' | awk '{print $2}' | grep -E 'linux-(image|headers|modules)-[0-9]+' || true"),
        run30("apt-get -s autoclean 2>&1 | grep '^Del' | wc -l"),
    );
    let current_kernel_r = run30("uname -r").await;
    let current_kernel = current_kernel_r.stdout.trim().to_string();

    let disk_parts: Vec<&str> = disk_r.stdout.trim().split_whitespace().collect();
    let orphan_count = orphan_count_r.stdout.trim().parse::<i64>().unwrap_or(0);
    let orphan_packages: Vec<&str> = orphan_list_r
        .stdout
        .trim()
        .lines()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    let autoclean_count = autoclean_r.stdout.trim().parse::<i64>().unwrap_or(0);

    let kernels: Vec<String> = kernels_r
        .stdout
        .trim()
        .lines()
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty())
        .collect();
    let old_kernels: Vec<String> = kernels
        .iter()
        .filter(|k| !k.contains(&current_kernel))
        .cloned()
        .collect();

    Ok(json!({
        "cacheSize": if cache_size_r.stdout.trim().is_empty() { "0".into() } else { cache_size_r.stdout.trim() },
        "disk": {
            "total": disk_parts.get(1).copied().unwrap_or(""),
            "used": disk_parts.get(2).copied().unwrap_or(""),
            "percent": disk_parts.get(4).copied().unwrap_or(""),
        },
        "orphans": {"count": orphan_count, "packages": orphan_packages},
        "oldKernels": {"count": old_kernels.len(), "kernels": old_kernels, "current": current_kernel},
        "autocleanCount": autoclean_count,
    }))
}

#[tauri::command]
pub async fn package_cleaner_clean(
    db: tauri::State<'_, Db>,
    token: Option<String>,
    actions: Vec<String>,
) -> Result<Value, String> {
    if actions.is_empty() {
        return Err("Actions list required".into());
    }
    let unique: HashSet<&str> = actions.iter().map(String::as_str).collect();
    let mut parts: Vec<String> = Vec::new();

    if unique.contains("autoremove") || unique.contains("old-kernels") {
        parts.push("sudo apt-get autoremove -y".into());
    }
    if unique.contains("clean") {
        parts.push("sudo apt-get clean".into());
    }
    if unique.contains("autoclean") {
        parts.push("sudo apt-get autoclean -y".into());
    }
    if unique.contains("old-kernels") {
        parts.push(
            "dpkg -l | grep '^ii' | awk '{print $2}' | grep -E 'linux-(image|headers|modules)-[0-9]+' | grep -v \"$(uname -r)\" | xargs -r sudo apt-get purge -y 2>/dev/null || true".into(),
        );
    }
    if parts.is_empty() {
        return Err("No valid actions".into());
    }
    let command = parts.join(" && ");
    Ok(audit_and_run(&db, &token.unwrap_or_default(), "package-cleaner", &command, 600).await)
}
