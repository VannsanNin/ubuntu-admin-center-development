use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

pub fn db_path() -> PathBuf {
    let base = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ubuntu-admin-center");
    let _ = std::fs::create_dir_all(&base);
    base.join("admin-center.db")
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00','now'))
);
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    command TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00','now'))
);
CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_path TEXT NOT NULL,
    destination_path TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'folder',
    compression INTEGER NOT NULL DEFAULT 1,
    encryption INTEGER NOT NULL DEFAULT 0,
    schedule TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    size TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f+00:00','now')),
    completed_at TEXT
);
CREATE TABLE IF NOT EXISTS command_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL,
    description TEXT NOT NULL,
    syntax TEXT NOT NULL,
    options TEXT,
    examples TEXT,
    common_mistakes TEXT,
    related_commands TEXT,
    category TEXT NOT NULL
);
"#;

const SEED_COMMANDS: &[(&str, &str, &str, &str, &str, &str, &str)] = &[
    (
        "apt update",
        "Refresh the local package index from the repositories",
        "sudo apt update",
        "-o Acquire::Retries=N: retry failed downloads N times",
        "sudo apt update",
        "Forgetting sudo results in permission errors",
        "apt upgrade, apt list",
    ),
    (
        "systemctl status",
        "Show the runtime status of a systemd unit",
        "systemctl status <unit>",
        "--no-pager: print without paging; -l: do not truncate lines",
        "systemctl status nginx --no-pager",
        "Unit names require the .service suffix only if ambiguous",
        "journalctl, systemctl restart",
    ),
    (
        "ufw allow",
        "Add a firewall rule permitting traffic on a port or app profile",
        "sudo ufw allow <port>/<protocol>",
        "from <addr>: restrict source; comment '<text>': annotate rule",
        "sudo ufw allow 22/tcp",
        "Rules take effect immediately even before 'ufw enable'",
        "ufw status, ufw delete",
    ),
    (
        "df -h",
        "Report filesystem disk usage in human-readable units",
        "df -h [path]",
        "-x tmpfs: exclude tmpfs entries; --output: choose columns",
        "df -h /var",
        "Confusing Filesystem with Mounted-on columns when scripting",
        "du, lsblk",
    ),
    (
        "docker ps",
        "List Docker containers",
        "docker ps [-a]",
        "-a: include stopped containers; --format: Go template output",
        "docker ps -a --format '{{json .}}'",
        "Using -q with rm without filtering can remove many containers at once",
        "docker start, docker logs",
    ),
];

impl Db {
    pub fn init() -> Result<Self, String> {
        let conn = Connection::open(db_path()).map_err(|e| e.to_string())?;
        conn.execute_batch(SCHEMA)
            .map_err(|e| format!("migration failed: {e}"))?;

        // SSH was extracted into a separate app; retire its local tables.
        let _ = conn.execute_batch(
            "DROP TABLE IF EXISTS ssh_tunnels;
             DROP TABLE IF EXISTS ssh_connection_history;
             DROP TABLE IF EXISTS ssh_hosts;",
        );

        // Seed the command library once.
        let seeded: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM command_library WHERE command = 'apt update'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(false);
        if !seeded {
            for (command, desc, syntax, options, examples, mistakes, related) in SEED_COMMANDS {
                let _ = conn.execute(
                    "INSERT INTO command_library (command, description, syntax, options, examples, common_mistakes, related_commands, category)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'General')",
                    rusqlite::params![command, desc, syntax, options, examples, mistakes, related],
                );
            }
        }

        Ok(Db(Mutex::new(conn)))
    }
}

/// Fire-and-forget audit logging (mirrors `log_action` in the Python service).
pub fn log_action(
    db: &Db,
    action: &str,
    module: &str,
    command: Option<&str>,
    details: Option<serde_json::Value>,
    user_id: Option<i64>,
) {
    if let Ok(conn) = db.0.lock() {
        let _ = conn.execute(
            "INSERT INTO audit_logs (user_id, action, module, command, details) VALUES (?1,?2,?3,?4,?5)",
            rusqlite::params![
                user_id,
                action,
                module,
                command,
                details.map(|d| d.to_string())
            ],
        );
    }
}
