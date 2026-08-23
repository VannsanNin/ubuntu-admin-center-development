# Ubuntu Admin Center

A native desktop administration dashboard for Ubuntu — system monitoring with
live graphs, package management, services, firewall, users, disks, backups,
Docker containers, a command library, an AI assistant, and audit logging.

Built as a **Tauri 2** app: a React frontend rendered in the system WebKit,
with all privileged operations handled by a Rust backend through Tauri IPC.
No web server, no database server — everything runs locally.

## Tech Stack

- **Shell:** Tauri 2 (Rust)
- **Backend:** Rust — tokio, rusqlite (bundled SQLite), bcrypt
- **Frontend:** React 19, Vite 7, TypeScript, Tailwind CSS 4, Radix UI, Recharts

## Features

- **Dashboard** — live telemetry: CPU, RAM, network throughput (computed from
  `/proc/net/dev` deltas), storage donut, and GPU usage/VRAM graphs
  (NVIDIA via `nvidia-smi`, AMD via sysfs). Light/dark theme.
- **Installed Apps / Software Installer / Package Cleaner** — apt inventory,
  curated install batches, cache/orphan cleanup analysis
- **Packages** — search, install, remove, hold management
- **Services & Processes** — systemd control, process inspection and signals
- **Users** — account/group administration
- **Firewall** — ufw rule management
- **Repositories** — APT source toggling, testing, backup/restore
- **Files** — browse, upload, download (to `~/Downloads`), manage permissions
- **Logs** — aggregated syslog/auth/kernel/dmesg/webserver logs with filtering
- **Docker** — container lifecycle, compose projects, stats
- **Network / Disk** — interface info, connectivity tools, SMART-ish disk views
- **Backups** — archive creation/restoration, optional GPG encryption, cron scheduling
- **Commands** — reusable command library with streamed output
- **AI Assistant** — offline knowledge-base assistant for common admin tasks
- **Audit Logs** — local trail of administrative actions

## Prerequisites

- Ubuntu (or another Linux with GTK/WebKit)
- Node.js 20+ and npm
- Rust toolchain (`rustup`)
- System libraries:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

## Getting Started

```bash
npm install
npm run tauri dev      # development
npm run tauri build    # production bundles (.deb/.rpm/AppImage)
```

There is no login screen — the app runs as your local user. Commands that
require root (package installs, service restarts, ufw changes, …) rely on
passwordless sudo or a polkit authentication agent, matching the behavior of
the original web version.

## Data & Storage

- SQLite database: `~/.local/share/ubuntu-admin-center/admin-center.db`
  (users, audit logs, backups, command library)
- Backups are written to the directory configured in the Backups module

## Project Structure

```
src/                  React frontend
  lib/api.ts          axios-style bridge over Tauri invoke()
  lib/streams.ts      WebSocket-like shim over Tauri events
  components/         feature modules (dashboard, docker, packages, …)
src-tauri/
  src/shell.rs        sandboxed command runner (ports Python run_command)
  src/db.rs           SQLite schema + seed data
  src/streams.rs      stats/command event streams
  src/commands/*.rs   one module per admin domain
```

## Notes

- Frontend port is fixed to 1420 in dev (required by Tauri).
- The `sudo`-based features behave identically to the previous FastAPI
  implementation; no credentials are stored by the app itself.
- SSH functionality was extracted into a separate app and is no longer
  included here.
