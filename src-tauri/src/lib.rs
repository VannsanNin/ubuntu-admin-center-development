mod commands;
mod db;
mod shell;
mod streams;

use std::sync::Mutex;

use commands::{
    ai, audit, auth, backups, command_library, disk, docker, files, firewall, logs, network,
    packages, processes, repositories, services, setup, system, users,
};
use db::Db;
use streams::StreamManager;
use tauri::{Emitter, Manager};

const MAIN_WINDOW_LABEL: &str = "main";
const USAGE_OVERLAY_LABEL: &str = "usage-overlay";
const USAGE_SELECTION_EVENT: &str = "usage-selection-changed";

#[derive(Default)]
struct UsageSelectionState {
    metrics: Mutex<Vec<String>>,
}

fn usage_overlay_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(USAGE_OVERLAY_LABEL)
        .ok_or_else(|| "usage overlay window is unavailable".to_string())
}

fn update_usage_overlay_visibility(app: &tauri::AppHandle, visible: bool) -> Result<(), String> {
    let overlay = usage_overlay_window(app)?;
    if visible {
        overlay
            .set_visible_on_all_workspaces(true)
            .map_err(|error| error.to_string())?;
        overlay.show().map_err(|error| error.to_string())?;
        overlay
            .set_always_on_top(true)
            .map_err(|error| error.to_string())?;
    } else {
        overlay.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn show_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "main window is unavailable".to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

fn toggle_usage_overlay(app: &tauri::AppHandle) -> Result<(), String> {
    let overlay = usage_overlay_window(app)?;
    let visible = overlay.is_visible().map_err(|error| error.to_string())?;
    update_usage_overlay_visibility(app, !visible)
}

fn position_usage_overlay(app: &tauri::AppHandle) -> Result<(), String> {
    let overlay = usage_overlay_window(app)?;
    let Some(monitor) = overlay
        .primary_monitor()
        .map_err(|error| error.to_string())?
    else {
        return Ok(());
    };
    let work_area = monitor.work_area();
    let overlay_size = overlay.outer_size().map_err(|error| error.to_string())?;
    let margin = (16.0 * monitor.scale_factor()).round() as i32;
    let x = work_area.position.x + work_area.size.width as i32 - overlay_size.width as i32 - margin;
    let y = work_area.position.y + margin;
    overlay
        .set_position(tauri::PhysicalPosition::new(x, y))
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_usage_selection(
    state: tauri::State<'_, UsageSelectionState>,
) -> Result<Vec<String>, String> {
    state
        .metrics
        .lock()
        .map(|metrics| metrics.clone())
        .map_err(|_| "failed to read usage selection".to_string())
}

#[tauri::command]
fn set_usage_selection(
    app: tauri::AppHandle,
    state: tauri::State<'_, UsageSelectionState>,
    metrics: Vec<String>,
) -> Result<(), String> {
    let mut selected = Vec::new();
    for metric in ["cpu", "ram", "gpu"] {
        if metrics.iter().any(|value| value == metric) {
            selected.push(metric.to_string());
        }
    }

    *state
        .metrics
        .lock()
        .map_err(|_| "failed to update usage selection".to_string())? = selected.clone();
    app.emit_to(USAGE_OVERLAY_LABEL, USAGE_SELECTION_EVENT, &selected)
        .map_err(|error| error.to_string())?;
    update_usage_overlay_visibility(&app, !selected.is_empty())
}

#[tauri::command]
fn set_usage_overlay_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    update_usage_overlay_visibility(&app, visible)
}

#[tauri::command]
async fn stream_start(
    app: tauri::AppHandle,
    mgr: tauri::State<'_, StreamManager>,
    kind: String,
    payload: Option<serde_json::Value>,
) -> Result<String, String> {
    streams::start(app, mgr, kind, payload).await
}

#[tauri::command]
async fn stream_input(
    app: tauri::AppHandle,
    mgr: tauri::State<'_, StreamManager>,
    id: String,
    data: String,
) -> Result<(), String> {
    streams::input(app, mgr, id, data).await
}

#[tauri::command]
fn stream_stop(mgr: tauri::State<'_, StreamManager>, id: String) -> Result<(), String> {
    streams::stop(mgr, id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let database = Db::init().expect("failed to initialize local database");

    tauri::Builder::default()
        .manage(database)
        .manage(StreamManager::new())
        .manage(UsageSelectionState::default())
        .on_menu_event(|app, event| {
            if event.id() == "open-dashboard" {
                let _ = show_main_window(app);
            } else if event.id() == "toggle-usage-overlay" {
                let _ = toggle_usage_overlay(app);
            } else if event.id() == "exit" {
                app.exit(0);
            }
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == MAIN_WINDOW_LABEL || window.label() == USAGE_OVERLAY_LABEL {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .setup(|app| {
            let _ = position_usage_overlay(app.handle());
            let menu = tauri::menu::MenuBuilder::new(app)
                .text("open-dashboard", "Open Dashboard")
                .separator()
                .text("toggle-usage-overlay", "Show / Hide Usage Widget")
                .separator()
                .text("exit", "Exit")
                .build()?;
            let mut tray = tauri::tray::TrayIconBuilder::with_id("main-tray")
                .tooltip("Ubuntu Admin Center")
                .menu(&menu);
            if let Some(icon) = app.default_window_icon().cloned() {
                tray = tray.icon(icon);
            }
            let _tray = tray.build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_usage_selection,
            set_usage_selection,
            set_usage_overlay_visible,
            // streams (WebSocket replacements)
            stream_start,
            stream_input,
            stream_stop,
            // system
            system::system_info,
            // auth
            auth::auth_login,
            auth::auth_register,
            // packages & friends
            packages::packages_get,
            packages::packages_manage,
            packages::software_installer,
            packages::software_installer_check,
            packages::package_cleaner_analyze,
            packages::package_cleaner_clean,
            // core system management
            services::services_get,
            services::services_manage,
            processes::processes_get,
            processes::processes_manage,
            users::users_get,
            users::users_manage,
            firewall::firewall_get,
            firewall::firewall_manage,
            files::files_list,
            files::files_manage,
            files::files_upload,
            files::files_download,
            logs::logs_get,
            docker::docker_get,
            docker::docker_manage,
            network::network_get,
            disk::disk_get,
            repositories::repositories_get,
            repositories::repositories_manage,
            setup::setup_status,
            setup::setup_run,
            // data modules
            backups::backups_list,
            backups::backups_manage,
            command_library::commands_list,
            command_library::commands_create,
            audit::audit_logs_list,
            ai::ai_ask,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
