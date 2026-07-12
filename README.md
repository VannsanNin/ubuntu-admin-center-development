# Ubuntu Admin Center

A self-contained native desktop application for Ubuntu system administration, built with Rust, GTK4, and Libadwaita.

Replaces the previous web-based (Next.js + FastAPI) implementation with a single native binary that calls system commands directly.

## Features

| Module | Description |
|---|---|
| **Dashboard** | System overview — hostname, uptime, memory, disk, CPU load |
| **Packages** | Search, install, remove, update, and upgrade APT packages |
| **Installed Apps** | Browse installed `.deb` packages with uninstall support |
| **Software Installer** | One-click install/remove of curated software categories |
| **Package Cleaner** | Clean APT cache, orphaned packages, and residual configs |
| **Services** | List, start, stop, restart systemd services; view journal logs |
| **Processes** | View and search running processes, sort by CPU or memory |
| **Users** | Create, lock, unlock, and delete system users |
| **Firewall** | UFW rule management — enable/disable, allow/deny, list rules |
| **Repositories** | View, add, backup, and refresh APT sources |
| **Files** | Browse filesystem with path entry, back/forward navigation |
| **Logs** | View system logs (syslog, auth, kern, dmesg) with filtering and auto-refresh |
| **Docker** | List containers and images; start, stop, remove, view logs, pull images |
| **Network** | View IP/gateway/DNS, ping, traceroute |
| **Disk** | View mounts, scan directory usage |
| **Backups** | Create and restore compressed archives |
| **SSH** | Quick-connect to hosts and generate SSH keys |
| **Commands** | Run arbitrary system commands with output display |
| **AI Assistant** | AI-powered command suggestions via Ollama |
| **Audit Logs** | Monitor security-relevant system events |

## Requirements

- **Ubuntu Linux** (or any Debian-based distribution)
- **GTK 4.14+** and **libadwaita 1.5+**
- **Rust 1.77+** (edition 2021)
- **sudo** access (for system administration operations)

## Build

```bash
cargo build --release
```

## Run

Most operations require root privileges:

```bash
sudo ./target/release/ubuntu-admin-center
```

## Development

Auto-reload on file changes (installs `cargo-watch` if needed):

```bash
cargo install cargo-watch
cargo watch -x run -w src/
```

## Architecture

- **Frontend:** GTK4 + libadwaita (`gtk4-rs` 0.9, `libadwaita-rs` 0.7)
- **Async runtime:** Tokio for non-blocking system command execution
- **Sidebar navigation:** 20 modules switchable via `AdwStack`
- **Window layout:** `Paned` with sidebar `ListBox` on the left and content `Stack` on the right
- **Backend:** Calls system tools (`apt`, `systemctl`, `ufw`, `docker`, `ip`, etc.) via `tokio::process::Command`

### Key Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `gtk4` | 0.9 (v4_14) | GUI toolkit |
| `libadwaita` | 0.7 (v1_5) | Adwaita widgets and styling |
| `tokio` | 1 (full) | Async runtime |
| `serde` / `serde_json` | 1 | Data serialization |
| `regex` | 1 | Pattern matching |
| `chrono` | 0.4 | Timestamp formatting |
| `uuid` | 1 (v4) | Unique identifiers |

## Project Structure

```
src/
├── main.rs                # Application entry point, window layout, sidebar
├── system/
│   ├── mod.rs
│   └── commands.rs        # Data types, run_command(), run_shell(), sanitize_input()
└── modules/
    ├── mod.rs
    ├── dashboard.rs
    ├── packages.rs
    ├── installed_apps.rs
    ├── software_installer.rs
    ├── package_cleaner.rs
    ├── services.rs
    ├── processes.rs
    ├── users.rs
    ├── firewall.rs
    ├── repositories.rs
    ├── files.rs
    ├── logs.rs
    ├── docker.rs
    ├── network.rs
    ├── disk.rs
    ├── backups.rs
    ├── ssh.rs
    ├── commands.rs
    ├── ai_assistant.rs
    └── audit_logs.rs
```

Each module exports a single `pub fn create() -> Box` that returns a GTK widget.

## License

MIT
