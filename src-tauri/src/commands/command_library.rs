use crate::db::Db;
use rusqlite::params;
use serde_json::{json, Value};

#[tauri::command]
pub async fn commands_list(
    db: tauri::State<'_, Db>,
    search: Option<String>,
    category: Option<String>,
) -> Result<Value, String> {
    let search = format!("%{}%", search.unwrap_or_default());
    let category = category.unwrap_or_default();
    let has_category = !category.is_empty();

    let conn = db.0.lock().map_err(|_| "db lock")?;
    let sql = if has_category {
        "SELECT id, command, description, syntax, options, examples, common_mistakes, related_commands, category
         FROM command_library
         WHERE (command LIKE ?1 OR description LIKE ?1 OR category LIKE ?1) AND category = ?2
         ORDER BY command"
    } else {
        "SELECT id, command, description, syntax, options, examples, common_mistakes, related_commands, category
         FROM command_library
         WHERE (command LIKE ?1 OR description LIKE ?1 OR category LIKE ?1)
         ORDER BY command"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let map_row = |r: &rusqlite::Row| -> rusqlite::Result<Value> {
        Ok(json!({
            "id": r.get::<_, i64>(0)?,
            "command": r.get::<_, String>(1)?,
            "description": r.get::<_, String>(2)?,
            "syntax": r.get::<_, String>(3)?,
            "options": r.get::<_, Option<String>>(4)?,
            "examples": r.get::<_, Option<String>>(5)?,
            "commonMistakes": r.get::<_, Option<String>>(6)?,
            "relatedCommands": r.get::<_, Option<String>>(7)?,
            "category": r.get::<_, String>(8)?,
        }))
    };

    let rows = if has_category {
        stmt.query_map(params![search, category], map_row)
    } else {
        stmt.query_map(params![search], map_row)
    }
    .map_err(|e| e.to_string())?;

    Ok(json!({ "commands": rows.filter_map(Result::ok).collect::<Vec<_>>() }))
}

#[derive(serde::Deserialize)]
pub struct CommandLibEntry {
    pub command: String,
    pub description: String,
    pub syntax: String,
    pub options: Option<String>,
    pub examples: Option<String>,
    #[serde(rename = "commonMistakes")]
    pub common_mistakes: Option<String>,
    #[serde(rename = "relatedCommands")]
    pub related_commands: Option<String>,
    pub category: Option<String>,
}

#[tauri::command]
pub async fn commands_create(
    db: tauri::State<'_, Db>,
    body: CommandLibEntry,
) -> Result<Value, String> {
    if body.command.is_empty() || body.description.is_empty() || body.syntax.is_empty() {
        return Err("command, description, and syntax are required".into());
    }
    let category = body.category.unwrap_or_else(|| "General".into());

    let id = {
        let conn = db.0.lock().map_err(|_| "db lock")?;
        conn.execute(
            "INSERT INTO command_library (command, description, syntax, options, examples, common_mistakes, related_commands, category)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                body.command,
                body.description,
                body.syntax,
                body.options,
                body.examples,
                body.common_mistakes,
                body.related_commands,
                category,
            ],
        )
        .map_err(|e| e.to_string())?;
        conn.last_insert_rowid()
    };

    Ok(json!({
        "id": id,
        "command": body.command,
        "description": body.description,
        "syntax": body.syntax,
        "options": body.options,
        "examples": body.examples,
        "commonMistakes": body.common_mistakes,
        "relatedCommands": body.related_commands,
        "category": category,
    }))
}
