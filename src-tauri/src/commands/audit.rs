use crate::db::Db;
use serde_json::{json, Value};

#[tauri::command]
pub async fn audit_logs_list(db: tauri::State<'_, Db>) -> Result<Value, String> {
    let conn = db.0.lock().map_err(|_| "db lock")?;
    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, action, module, command, details, ip_address, created_at
             FROM audit_logs ORDER BY created_at DESC LIMIT 500",
        )
        .map_err(|e| e.to_string())?;

    let logs = stmt
        .query_map([], |r| {
            // details stored as JSON text; pass through when valid
            let details_text: Option<String> = r.get(5)?;
            Ok(json!({
                "id": r.get::<_, i64>(0)?,
                "userId": r.get::<_, Option<i64>>(1)?,
                "action": r.get::<_, String>(2)?,
                "module": r.get::<_, String>(3)?,
                "command": r.get::<_, Option<String>>(4)?,
                "details": details_text.and_then(|t| serde_json::from_str::<Value>(&t).ok()),
                "ipAddress": r.get::<_, Option<String>>(6)?,
                "createdAt": r.get::<_, Option<String>>(7)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    Ok(json!({ "logs": logs }))
}
