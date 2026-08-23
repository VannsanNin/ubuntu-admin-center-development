use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::LazyLock;

type KbEntry = (&'static str, Vec<&'static str>, bool);
static KB: LazyLock<HashMap<&'static str, KbEntry>> = LazyLock::new(|| {
    let entries: &[(&str, KbEntry)] = &[
        ("install", ("To install software on Ubuntu, use the apt package manager. First update your package lists with 'sudo apt update', then install with 'sudo apt install <package-name>'.", vec!["sudo apt update", "sudo apt install <package-name>"], false)),
        ("docker", ("Docker can be installed on Ubuntu using the official script or apt. The recommended way is: sudo apt update && sudo apt install docker.io, then start the service with sudo systemctl start docker.", vec!["sudo apt update", "sudo apt install docker.io", "sudo systemctl start docker"], false)),
        ("nginx", ("Common nginx issues include: configuration errors, port conflicts, or the service not running. Check status with 'systemctl status nginx', test config with 'nginx -t', and view logs with 'journalctl -u nginx'.", vec!["systemctl status nginx", "nginx -t", "journalctl -u nginx --no-pager -n 50"], false)),
        ("firewall", ("UFW (Uncomplicated Firewall) is the default firewall tool on Ubuntu. Enable it with 'sudo ufw enable', allow ports with 'sudo ufw allow <port>', and check status with 'sudo ufw status verbose'.", vec!["sudo ufw status verbose", "sudo ufw allow 22/tcp", "sudo ufw enable"], false)),
        ("user", ("To manage users: create with 'sudo useradd -m <username>', set password with 'sudo passwd <username>', delete with 'sudo userdel -r <username>'. List all users with 'getent passwd'.", vec!["sudo useradd -m <username>", "sudo passwd <username>", "getent passwd"], false)),
        ("backup", ("Back up directories using tar: 'sudo tar -czf backup.tar.gz /path/to/source'. Restore with: 'sudo tar -xzf backup.tar.gz -C /'. For automated backups, consider setting up a cron job or using rsync.", vec!["tar -czf backup.tar.gz /path/to/source", "tar -xzf backup.tar.gz -C /"], false)),
        ("disk", ("Check disk usage with 'df -h' for mounted drives and 'du -sh /path' for directory sizes. Find large files with 'find / -type f -size +100M'.", vec!["df -h", "du -sh /path", "find / -type f -size +100M"], false)),
        ("process", ("View running processes with 'ps aux', sort by CPU with 'ps aux --sort=-%cpu', kill a process with 'kill <PID>'. Use 'top' or 'htop' for real-time monitoring.", vec!["ps aux --sort=-%cpu", "kill <PID>"], false)),
        ("service", ("Manage services with systemctl: 'sudo systemctl start/stop/restart/status <service>'. Enable at boot with 'sudo systemctl enable <service>'. View logs with 'journalctl -u <service>'.", vec!["sudo systemctl status <service>", "journalctl -u <service> --no-pager -n 50"], false)),
        ("network", ("Check network configuration with 'ip addr show', test connectivity with 'ping <host>', view routing with 'ip route', and check DNS with 'cat /etc/resolv.conf'.", vec!["ip addr show", "ip route", "ping -c 4 google.com"], false)),
        ("permission", ("Change file permissions with 'chmod' (e.g., 'chmod 755 file'), change owner with 'chown user:group file'. Be careful with 'chmod -R' and 'sudo' as it can affect many files.", vec!["chmod 755 <file>", "chown user:group <file>"], true)),
        ("update", ("Update Ubuntu packages: 'sudo apt update' refreshes package lists, 'sudo apt upgrade' installs available upgrades. For distribution upgrades, use 'sudo do-release-upgrade'.", vec!["sudo apt update", "sudo apt upgrade -y"], false)),
        ("log", ("View logs with 'journalctl' for systemd logs, 'tail -f /var/log/syslog' for real-time system logs, 'dmesg' for kernel messages, and 'cat /var/log/auth.log' for authentication logs.", vec!["journalctl --no-pager -n 50", "tail -f /var/log/syslog", "dmesg | tail -20"], false)),
        ("ssh", ("Connect via SSH: 'ssh user@host'. Generate keys with 'ssh-keygen -t rsa -b 4096', copy to server with 'ssh-copy-id user@host'. For security, disable root login and use key-based auth.", vec!["ssh-keygen -t rsa -b 4096", "ssh-copy-id user@host", "ssh user@host"], false)),
        ("container", ("Docker commands: list containers with 'docker ps -a', start with 'docker start <name>', stop with 'docker stop <name>', view logs with 'docker logs <name>', remove with 'docker rm <name>'.", vec!["docker ps -a", "docker start <name>", "docker stop <name>", "docker logs <name>"], false)),
    ];
    entries.iter().map(|(k, v)| (*k, v.clone())).collect()
});

#[tauri::command]
pub async fn ai_ask(question: String) -> Result<Value, String> {
    let q = question.to_lowercase();
    for (keyword, (answer, commands, caution)) in KB.iter() {
        if q.contains(keyword) {
            return Ok(json!({
                "answer": answer,
                "commands": commands,
                "caution": caution,
            }));
        }
    }
    Ok(json!({
        "answer": "I can help you with Ubuntu administration. Try asking about: package installation, services, Docker, firewall, users, backups, disk management, processes, networking, permissions, SSH, logs, or updates.",
        "commands": [],
        "caution": false,
    }))
}
