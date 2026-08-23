mod commands;
mod db;
mod shell;
mod streams;

use commands::{
    ai, audit, auth, backups, command_library, disk, docker, files, firewall, logs, network,
    packages, processes, repositories, services, setup, system, users,
};
use db::Db;
use streams::StreamManager;

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
        .invoke_handler(tauri::generate_handler![
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
