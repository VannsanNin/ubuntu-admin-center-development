//! Replaces two FastAPI WebSockets:
//!   /api/system/ws          -> kind="stats"   (server pushes telemetry JSON every second)
//!   /api/system/commands/ws -> kind="command" (client sends {"command": ...}; server streams stdout/stderr/exit)
//!
//! Frames travel over Tauri events named `stream:{id}`. Payloads are strings,
//! exactly like WebSocket text frames, so the frontend shim stays dumb.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::process::Child;
use tokio::task::JoinHandle;

struct CommandStream {
    child: Arc<Mutex<Option<Child>>>,
    started: Arc<AtomicBool>,
}

enum Entry {
    Stats(JoinHandle<()>),
    Command(CommandStream),
}

pub struct StreamManager {
    entries: Arc<Mutex<HashMap<String, Entry>>>,
}

impl Default for StreamManager {
    fn default() -> Self {
        Self::new()
    }
}

impl StreamManager {
    pub fn new() -> Self {
        StreamManager {
            entries: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn remove(&self, id: &str) -> Option<Entry> {
        self.entries.lock().ok()?.remove(id)
    }
}

fn ev_name(id: &str) -> String {
    format!("stream:{id}")
}

/// Start a stream. Returns the stream id.
pub async fn start(
    app: AppHandle,
    mgr: tauri::State<'_, StreamManager>,
    kind: String,
    _payload: Option<Value>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let ev = ev_name(&id);

    match kind.as_str() {
        // ---- /api/system/ws replacement -------------------------------
        "stats" => {
            let handle = tokio::spawn(async move {
                loop {
                    let snapshot = crate::commands::system::snapshot().await;
                    let _ = app.emit(&ev, snapshot.to_string());
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
            });
            mgr.entries
                .lock()
                .map_err(|_| "stream lock")?
                .insert(id.clone(), Entry::Stats(handle));
            Ok(id)
        }

        // ---- /api/system/commands/ws replacement ----------------------
        "command" => {
            let stream = CommandStream {
                child: Arc::new(Mutex::new(None)),
                started: Arc::new(AtomicBool::new(false)),
            };
            mgr.entries
                .lock()
                .map_err(|_| "stream lock")?
                .insert(id.clone(), Entry::Command(stream));
            Ok(id)
        }

        _ => Err("Unknown stream kind".into()),
    }
}

/// Client -> stream bytes. For "command" kind the FIRST input carries
/// `{"command": "..."}` and boots the process (mirrors the old ws.send flow).
pub async fn input(
    app: AppHandle,
    mgr: tauri::State<'_, StreamManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    let is_command = {
        let mut map = mgr.entries.lock().map_err(|_| "stream lock")?;
        match map.get_mut(&id) {
            Some(Entry::Command(cs)) => cs.started.load(Ordering::SeqCst),
            _ => return Err("Stream not found".into()),
        }
    };

    if is_command {
        return Err("Command already started".into());
    }

    // Command stream: first input starts the process.
    let (started, child_slot) = {
        let mut map = mgr.entries.lock().map_err(|_| "stream lock")?;
        match map.get_mut(&id) {
            Some(Entry::Command(cs)) => (cs.started.clone(), cs.child.clone()),
            _ => return Err("Stream not found".into()),
        }
    };

    let parsed: Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    let command = parsed
        .get("command")
        .and_then(Value::as_str)
        .filter(|c| !c.is_empty())
        .ok_or("No command provided")?
        .to_string();

    started.store(true, Ordering::SeqCst);

    let ev2 = ev_name(&id);
    let app2 = app.clone();

    let mut child = tokio::process::Command::new("sh")
        .arg("-c")
        .arg(&command)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn: {e}"))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    *child_slot.lock().map_err(|_| "child lock")? = Some(child);

    let ev_out = ev2.clone();
    let app_out = app2.clone();
    if let Some(out) = stdout {
        tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let reader = tokio::io::BufReader::new(out);
            let mut lines = reader.lines();
            while let Ok(Some(l)) = lines.next_line().await {
                let frame = json!({"type": "stdout", "data": format!("{l}\n")});
                let _ = app_out.emit(&ev_out, frame.to_string());
            }
        });
    }

    let ev_err = ev2.clone();
    let app_err = app2.clone();
    if let Some(err) = stderr {
        tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let reader = tokio::io::BufReader::new(err);
            let mut lines = reader.lines();
            while let Ok(Some(l)) = lines.next_line().await {
                let frame = json!({"type": "stderr", "data": format!("{l}\n")});
                let _ = app_err.emit(&ev_err, frame.to_string());
            }
        });
    }

    // Exit watcher: emits {"type":"exit","exitCode":n} then cleans up.
    let mgr_entries = mgr.entries.clone();
    let ev_exit = ev2;
    let app_exit = app2;
    let exit_id = id.clone();
    tokio::spawn(async move {
        let code = loop {
            {
                let mut guard = child_slot.lock().unwrap_or_else(|e| e.into_inner());
                if let Some(c) = guard.as_mut() {
                    match c.try_wait() {
                        Ok(Some(status)) => break status.code().unwrap_or(0) as i64,
                        Ok(None) => {}
                        Err(_) => break -1,
                    }
                } else {
                    break -1;
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        };
        let _ = app_exit.emit(
            &ev_exit,
            json!({"type": "exit", "exitCode": code}).to_string(),
        );
        if let Ok(mut map) = mgr_entries.lock() {
            map.remove(&exit_id);
        }
    });

    Ok(())
}

/// Stop/cancel a stream.
pub fn stop(mgr: tauri::State<'_, StreamManager>, id: String) -> Result<(), String> {
    let entry = mgr.remove(&id).ok_or("Stream not found")?;
    match entry {
        Entry::Stats(handle) => {
            handle.abort();
        }
        Entry::Command(cs) => {
            if let Ok(mut slot) = cs.child.lock() {
                if let Some(child) = slot.as_mut() {
                    let _ = child.start_kill();
                }
            }
        }
    }
    Ok(())
}
