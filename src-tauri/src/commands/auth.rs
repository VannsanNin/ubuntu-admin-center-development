use crate::db::{log_action, Db};
use crate::shell::user_id_from_token;
use bcrypt::{hash, verify, DEFAULT_COST};
use rand::Rng;
use rusqlite::params;
use serde_json::{json, Value};

fn issue_token(user_id: i64) -> String {
    let rnd: u64 = rand::thread_rng().gen();
    format!("{user_id}.{rnd:x}")
}

fn fetch_user(conn: &rusqlite::Connection, username: &str) -> Option<(i64, String, String, String, bool)> {
    conn.query_row(
        "SELECT id, username, password_hash, role, is_active FROM users WHERE username = ?1",
        params![username],
        |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get::<_, i64>(4)? != 0,
            ))
        },
    )
    .ok()
}

#[tauri::command]
pub async fn auth_login(db: tauri::State<'_, Db>, username: String, password: String) -> Result<Value, String> {
    let row = {
        let conn = db.0.lock().map_err(|_| "db lock")?;
        fetch_user(&conn, &username)
    };

    match row {
        Some((id, name, hash_pw, role, active)) if active => {
            if verify(&password, &hash_pw).map_err(|e| e.to_string())? {
                log_action(&db, "LOGIN_SUCCESS", "auth", None, Some(json!({"username": name})), Some(id));
                return Ok(json!({
                    "token": issue_token(id),
                    "user": {"id": id, "username": name, "role": role},
                }));
            }
            log_action(&db, "LOGIN_FAILED", "auth", None, Some(json!({"username": username})), Some(id));
            Err("Invalid credentials".into())
        }
        _ => Err("Invalid credentials".into()),
    }
}

#[tauri::command]
pub async fn auth_register(db: tauri::State<'_, Db>, username: String, password: String) -> Result<Value, String> {
    if password.len() < 6 {
        return Err("Password must be at least 6 characters".into());
    }
    let hashed = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;

    let exists = {
        let conn = db.0.lock().map_err(|_| "db lock")?;
        fetch_user(&conn, &username).is_some()
    };
    if exists {
        return Err("Username already exists".into());
    }

    let id = {
        let conn = db.0.lock().map_err(|_| "db lock")?;
        conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?1, ?2, 'admin')",
            params![username, hashed],
        )
        .map_err(|e| e.to_string())?;
        conn.last_insert_rowid()
    };

    Ok(json!({
        "token": issue_token(id),
        "user": {"id": id, "username": username, "role": "admin"},
    }))
}

/// Helper for other modules: resolve auditing user from the token the bridge passes.
pub fn audit_user(token: &str) -> Option<i64> {
    user_id_from_token(token)
}
