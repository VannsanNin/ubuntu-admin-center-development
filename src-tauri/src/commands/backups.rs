use crate::db::{log_action, Db};
use crate::shell::{run, sanitize};
use chrono::Utc;
use rusqlite::params;
use serde_json::{json, Value};

#[tauri::command]
pub async fn backups_list(db: tauri::State<'_, Db>) -> Result<Value, String> {
    let conn = db.0.lock().map_err(|_| "db lock")?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, source_path, destination_path, type, compression, encryption,
                    schedule, status, size, created_at
             FROM backups ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |r| {
            Ok(json!({
                "id": r.get::<_, i64>(0)?,
                "name": r.get::<_, String>(1)?,
                "sourcePath": r.get::<_, String>(2)?,
                "destinationPath": r.get::<_, String>(3)?,
                "type": r.get::<_, String>(4)?,
                "compression": r.get::<_, i64>(5)? != 0,
                "encryption": r.get::<_, i64>(6)? != 0,
                "schedule": r.get::<_, Option<String>>(7)?,
                "status": r.get::<_, String>(8)?,
                "size": r.get::<_, Option<String>>(9)?,
                "createdAt": r.get::<_, Option<String>>(10)?,
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for row in rows {
        list.push(row.map_err(|e| e.to_string())?);
    }
    Ok(json!({ "backups": list }))
}

fn build_create_command(body: &Value) -> (String, String, String) {
    let name = sanitize(&body.get("name").and_then(Value::as_str).unwrap_or("backup"));
    let source = sanitize(&body.get("sourcePath").and_then(Value::as_str).unwrap_or("/etc"));
    let dest = sanitize(&body.get("destinationPath").and_then(Value::as_str).unwrap_or("/tmp"));
    let backup_type = body.get("type").and_then(Value::as_str).unwrap_or("folder").to_string();
    let compression = body.get("compression").and_then(Value::as_bool).unwrap_or(true);
    let encryption = body.get("encryption").and_then(Value::as_bool).unwrap_or(false);
    let encryption_password = body.get("encryptionPassword").and_then(Value::as_str).unwrap_or("");
    let incremental = body.get("incremental").and_then(Value::as_bool).unwrap_or(false);

    let mut command: String;
    if backup_type == "postgres" {
        let db_name = sanitize(&body.get("dbName").and_then(Value::as_str).unwrap_or("app_db"));
        command = if compression {
            format!("PGPASSWORD='' pg_dump -h 127.0.0.1 -U postgres {db_name} | gzip > {dest}/{name}.sql.gz 2>&1")
        } else {
            format!("PGPASSWORD='' pg_dump -h 127.0.0.1 -U postgres {db_name} > {dest}/{name}.sql 2>&1")
        };
    } else if backup_type == "sqlite" {
        let sqlite_path = sanitize(&body.get("sqlitePath").and_then(Value::as_str).unwrap_or(&source));
        command = if compression {
            format!("sqlite3 {sqlite_path} '.dump' | gzip > {dest}/{name}.sql.gz 2>&1")
        } else {
            format!("sqlite3 {sqlite_path} '.dump' > {dest}/{name}.sql 2>&1")
        };
    } else if incremental {
        let timestamp = Utc::now().format("%Y%m%d%H%M%S");
        command = format!(
            "sudo tar -czf {dest}/{name}.incr.{timestamp}.tar.gz --newer-mtime='1 day ago' {source} 2>&1"
        );
    } else if compression {
        command = format!("sudo tar -czf {dest}/{name}.tar.gz {source} 2>&1");
    } else {
        command = format!("sudo tar -cf {dest}/{name}.tar {source} 2>&1");
    }

    if encryption && !encryption_password.is_empty() {
        if backup_type == "postgres" || backup_type == "sqlite" {
            let ext = if compression { "sql.gz" } else { "sql" };
            command += &format!(
                " && gpg --batch --passphrase '{}' -c {dest}/{name}.{ext} 2>&1",
                encryption_password.replace('\'', "")
            );
        } else {
            let archive = if compression {
                format!("{dest}/{name}.tar.gz")
            } else {
                format!("{dest}/{name}.tar")
            };
            command += &format!(
                " && gpg --batch --passphrase '{}' -c {archive} 2>&1 && rm -f {archive}",
                encryption_password.replace('\'', "")
            );
        }
    }

    (command, name, source)
}

#[tauri::command]
pub async fn backups_manage(
    db: tauri::State<'_, Db>,
    token: Option<String>,
    body: Value,
) -> Result<Value, String> {
    let action = body
        .get("action")
        .and_then(Value::as_str)
        .ok_or("Invalid action")?
        .to_string();

    fn respond(command: String, stdout: &str, stderr: &str, exit_code: i64) -> Value {
        json!({"command": command, "stdout": stdout, "stderr": stderr, "exit_code": exit_code})
    }

    match action.as_str() {
        "create" => {
            let schedule = body.get("schedule").and_then(Value::as_str).unwrap_or("").to_string();
            let (command, name, source) = build_create_command(&body);

            let id = {
                let conn = db.0.lock().map_err(|_| "db lock")?;
                conn.execute(
                    "INSERT INTO backups (name, source_path, destination_path, type, compression, encryption, schedule, status)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'running')",
                    params![
                        name,
                        source,
                        sanitize(&body.get("destinationPath").and_then(Value::as_str).unwrap_or("/tmp")),
                        body.get("type").and_then(Value::as_str).unwrap_or("folder"),
                        body.get("compression").and_then(Value::as_bool).unwrap_or(true),
                        body.get("encryption").and_then(Value::as_bool).unwrap_or(false),
                        if schedule.is_empty() { None } else { Some(schedule.clone()) },
                    ],
                )
                .map_err(|e| e.to_string())?;
                conn.last_insert_rowid()
            };

            let result = run(&command, 300).await;
            {
                let conn = db.0.lock().map_err(|_| "db lock")?;
                conn.execute(
                    "UPDATE backups SET status = ?1, size = ?2, completed_at = strftime('%Y-%m-%d %H:%M:%f+00:00','now') WHERE id = ?3",
                    params![
                        if result.exit_code == 0 { "completed" } else { "failed" },
                        if result.stdout.is_empty() { "0KB".to_string() } else { format!("{:.1}KB", result.stdout.len() as f64 / 1024.0) },
                        id,
                    ],
                )
                .map_err(|e| e.to_string())?;
            }

            log_action(
                &db,
                "BACKUP_CREATE",
                "backups",
                Some(&command),
                Some(json!({"exitCode": result.exit_code})),
                token.as_deref().and_then(crate::commands::auth::audit_user),
            );

            // Set up cron schedule on success.
            if !schedule.is_empty() && result.exit_code == 0 {
                let cron_cmd = sanitize(&command);
                let cron_line = format!("{schedule} {cron_cmd} >> /var/log/backup-{name}.log 2>&1");
                run(
                    &format!("(crontab -l 2>/dev/null; echo \"{cron_line}\") | crontab -"),
                    15,
                )
                .await;
            }

            Ok(respond(command, &result.stdout, &result.stderr, result.exit_code))
        }
        "restore" => {
            let backup_id = body
                .get("backupId")
                .and_then(Value::as_i64)
                .ok_or("Backup ID required")?;
            let encryption_password = body
                .get("encryptionPassword")
                .and_then(Value::as_str)
                .unwrap_or("");

            let row: Option<(String, String, String, String, bool)> = {
                let conn = db.0.lock().map_err(|_| "db lock")?;
                conn.query_row(
                    "SELECT name, source_path, destination_path, type, encryption FROM backups WHERE id = ?1",
                    params![backup_id],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get::<_, i64>(4)? != 0)),
                )
                .ok()
            };
            let (name, _source, dest, btype, encrypted) = row.ok_or("Backup not found")?;

            let command = if encrypted && !encryption_password.is_empty() {
                let pw = encryption_password.replace('\'', "");
                format!(
                    "gpg --batch --passphrase '{pw}' -d {dest}/{name}.tar.gz.gpg > {dest}/{name}.tar.gz 2>&1 && sudo tar -xzf {dest}/{name}.tar.gz -C / 2>&1"
                )
            } else if btype == "postgres" || btype == "sqlite" {
                let sql_file = format!("{dest}/{name}.sql");
                // compression stored as artifact on disk; check for gz variant
                let gz_exists = std::path::Path::new(&format!("{sql_file}.gz")).exists();
                if gz_exists {
                    format!("gunzip -c {sql_file}.gz | psql -h 127.0.0.1 -U postgres -d {_source} 2>&1")
                } else {
                    format!("psql -h 127.0.0.1 -U postgres -d {_source} < {sql_file} 2>&1")
                }
            } else {
                // Detect archive extension on disk
                let gz_path = format!("{dest}/{name}.tar.gz");
                let gz = std::path::Path::new(&gz_path);
                if gz.exists() {
                    format!("sudo tar -xzf {dest}/{name}.tar.gz -C / 2>&1")
                } else {
                    format!("sudo tar -xf {dest}/{name}.tar -C / 2>&1")
                }
            };

            let result = run(&command, 300).await;
            log_action(
                &db,
                "BACKUP_RESTORE",
                "backups",
                Some(&command),
                Some(json!({"exitCode": result.exit_code})),
                token.as_deref().and_then(crate::commands::auth::audit_user),
            );
            Ok(respond(command, &result.stdout, &result.stderr, result.exit_code))
        }
        "delete" => {
            let backup_id = body
                .get("backupId")
                .and_then(Value::as_i64)
                .ok_or("Backup ID required")?;
            let deleted = {
                let conn = db.0.lock().map_err(|_| "db lock")?;
                conn.execute("DELETE FROM backups WHERE id = ?1", params![backup_id])
                    .map_err(|e| e.to_string())?
            };
            if deleted == 0 {
                return Err("Backup not found".into());
            }
            log_action(
                &db,
                "BACKUP_DELETE",
                "backups",
                Some(&format!("delete backup {backup_id}")),
                None,
                token.as_deref().and_then(crate::commands::auth::audit_user),
            );
            Ok(respond(format!("delete backup {backup_id}"), "Backup deleted", "", 0))
        }
        _ => Err("Invalid action".into()),
    }
}
