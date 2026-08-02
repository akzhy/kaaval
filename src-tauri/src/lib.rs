pub mod firewall;
mod modes;
mod network;
mod stats;

use std::collections::HashSet;
use std::sync::{Mutex, Once};

use base64::Engine;
use serde::Serialize;
use tauri::Manager;
use tracing::{error, info, warn};

use firewall::{FirewallManager, FirewallRuleDto};
use modes::{AppMatcher, KnownAppDto, Mode, ModeType, ModesState};
use network::NetworkRequestDto;
use stats::DashboardStatsDto;

#[derive(Default)]
struct FirewallState {
    manager: Option<FirewallManager>,
    init_error: Option<String>,
}

impl FirewallState {
    fn init() -> Self {
        match FirewallManager::new() {
            Ok(manager) => Self {
                manager: Some(manager),
                init_error: None,
            },
            Err(err) => {
                error!(error = %err, "failed to initialize firewall backend");
                Self {
                    manager: None,
                    init_error: Some(err.to_string()),
                }
            }
        }
    }
}

#[derive(Debug, Serialize)]
struct FirewallResponse {
    success: bool,
}

fn with_manager<T>(
    state: &tauri::State<'_, Mutex<FirewallState>>,
    f: impl FnOnce(&FirewallManager) -> firewall::Result<T>,
) -> std::result::Result<T, String> {
    let guard = state
        .inner()
        .lock()
        .map_err(|_| "failed to lock firewall state".to_string())?;

    let manager = guard.manager.as_ref().ok_or_else(|| {
        guard
            .init_error
            .clone()
            .unwrap_or_else(|| "firewall backend unavailable".to_string())
    })?;

    f(manager).map_err(|e| e.to_string())
}

#[tauri::command]
fn block_application(path: String, state: tauri::State<'_, Mutex<FirewallState>>) -> Result<FirewallResponse, String> {
    info!(path = %path, "blocking application");
    with_manager(&state, |manager| manager.block_app(path))?;
    Ok(FirewallResponse { success: true })
}

#[tauri::command]
fn unblock_application(path: String, state: tauri::State<'_, Mutex<FirewallState>>) -> Result<FirewallResponse, String> {
    info!(path = %path, "unblocking application");
    with_manager(&state, |manager| manager.unblock_app(path))?;
    Ok(FirewallResponse { success: true })
}

#[tauri::command]
fn is_application_blocked(path: String, state: tauri::State<'_, Mutex<FirewallState>>) -> Result<bool, String> {
    info!(path = %path, "checking block status");
    with_manager(&state, |manager| manager.is_blocked(path))
}

#[tauri::command]
fn list_firewall_rules(state: tauri::State<'_, Mutex<FirewallState>>) -> Result<Vec<FirewallRuleDto>, String> {
    info!("listing managed firewall rules");
    let rules = with_manager(&state, |manager| manager.list_rules())?;
    Ok(rules.into_iter().map(Into::into).collect())
}

#[tauri::command]
fn remove_all_firewall_rules(state: tauri::State<'_, Mutex<FirewallState>>) -> Result<FirewallResponse, String> {
    info!("removing all managed firewall rules");
    with_manager(&state, |manager| manager.remove_all_rules())?;
    Ok(FirewallResponse { success: true })
}

#[tauri::command]
fn list_network_requests(state: tauri::State<'_, Mutex<FirewallState>>, modes_state: tauri::State<'_, Mutex<ModesState>>) -> Result<Vec<NetworkRequestDto>, String> {
    info!("listing live network requests");
    let requests = network::list_network_requests()?;

    let distinct_paths = requests
        .iter()
        .map(|r| r.app_path.clone())
        .filter(|p| !p.starts_with("<pid:"))
        .collect::<HashSet<_>>();

    let mut blocked_paths = with_manager(&state, |manager| {
        let mut blocked = HashSet::new();
        for path in &distinct_paths {
            match manager.is_blocked(path) {
                Ok(true) => {
                    blocked.insert(network::normalize_path_key(path));
                }
                Ok(false) => {}
                Err(err) => {
                    warn!(path = %path, error = %err, "failed to determine blocked state for process path");
                }
            }
        }
        Ok(blocked)
    })
    .unwrap_or_default();

    {
        let modes = modes_state.inner().lock().map_err(|_| "failed to lock modes state".to_string())?;
        let mut observed = HashSet::new();
        for row in &requests {
            if row.app_path.starts_with("<pid:") {
                continue;
            }
            modes.note_seen(&row.app_path, &row.app_name);
            observed.insert(network::normalize_path_key(&row.app_path));
        }

        // A mode can block apps (default-deny, or an explicit block list) even
        // when no manual per-app rule exists, so merge that in here too.
        for path in &distinct_paths {
            let key = network::normalize_path_key(path);
            if modes.is_blocked_by_active_mode(&key) {
                blocked_paths.insert(key);
            }
        }

        reconcile_active_mode(&modes, &state, &observed);
    }

    Ok(network::to_dto_with_blocking(requests, &blocked_paths))
}

#[tauri::command]
fn get_dashboard_stats(state: tauri::State<'_, Mutex<FirewallState>>) -> Result<DashboardStatsDto, String> {
    let requests = network::list_network_requests()?;
    let active_sessions = stats::active_sessions(&network::to_dto_with_blocking(requests, &Default::default()));
    let blocked_today = with_manager(&state, |manager| Ok(manager.blocked_today())).unwrap_or(0);

    Ok(DashboardStatsDto {
        throughput_mbps: stats::throughput_mbps(),
        active_sessions,
        blocked_today,
    })
}

/// Applies or removes WFP enforcement for one mode's matched app, based on its type.
fn apply_mode_enforcement(manager: &FirewallManager, mode_type: ModeType, path: &str, enabled: bool) {
    let result = match mode_type {
        ModeType::BlockAllExcept => manager.set_mode_permit(path, enabled),
        ModeType::BlockThese => manager.set_mode_block(path, enabled),
    };
    if let Err(err) = result {
        warn!(path, enabled, error = %err, "failed to sync mode enforcement for app");
    }
}

/// Re-evaluates the active mode's matchers against known/observed apps and
/// applies only the incremental filter changes needed (best-effort).
fn reconcile_active_mode(modes_state: &ModesState, state: &tauri::State<'_, Mutex<FirewallState>>, observed: &HashSet<String>) {
    let Some(mode) = modes_state.active_mode() else {
        return;
    };

    let matched = modes_state.resolve_matches(&mode, observed);
    let (to_add, to_remove) = modes_state.diff_applied(matched);
    if to_add.is_empty() && to_remove.is_empty() {
        return;
    }

    let _ = with_manager(state, |manager| {
        for key in &to_add {
            let path = modes_state.original_path_for(key).unwrap_or_else(|| key.clone());
            apply_mode_enforcement(manager, mode.mode_type, &path, true);
        }
        for key in &to_remove {
            let path = modes_state.original_path_for(key).unwrap_or_else(|| key.clone());
            apply_mode_enforcement(manager, mode.mode_type, &path, false);
        }
        Ok(())
    });
}

/// Tears down all enforcement (default-deny and/or per-app filters) for a mode.
fn teardown_mode(modes_state: &ModesState, state: &tauri::State<'_, Mutex<FirewallState>>, mode: &Mode) {
    let applied = modes_state.clear_applied();
    let _ = with_manager(state, |manager| {
        for key in &applied {
            let path = modes_state.original_path_for(key).unwrap_or_else(|| key.clone());
            apply_mode_enforcement(manager, mode.mode_type, &path, false);
        }
        if mode.mode_type == ModeType::BlockAllExcept {
            if let Err(err) = manager.set_default_deny(false) {
                warn!(error = %err, "failed to disable default-deny filters");
            }
        }
        Ok(())
    });
}

#[tauri::command]
fn list_modes(modes_state: tauri::State<'_, Mutex<ModesState>>) -> Result<Vec<Mode>, String> {
    let modes = modes_state.inner().lock().map_err(|_| "failed to lock modes state".to_string())?;
    Ok(modes.list_modes())
}

#[tauri::command]
fn list_known_apps(modes_state: tauri::State<'_, Mutex<ModesState>>) -> Result<Vec<KnownAppDto>, String> {
    let modes = modes_state.inner().lock().map_err(|_| "failed to lock modes state".to_string())?;
    Ok(modes.list_known_apps())
}

#[tauri::command]
fn create_mode(
    name: String,
    icon_data_url: Option<String>,
    mode_type: ModeType,
    matchers: Vec<AppMatcher>,
    modes_state: tauri::State<'_, Mutex<ModesState>>,
) -> Result<Mode, String> {
    let modes = modes_state.inner().lock().map_err(|_| "failed to lock modes state".to_string())?;
    Ok(modes.create_mode(name, icon_data_url, mode_type, matchers))
}

#[tauri::command]
fn update_mode(
    id: String,
    name: String,
    icon_data_url: Option<String>,
    mode_type: ModeType,
    matchers: Vec<AppMatcher>,
    modes_state: tauri::State<'_, Mutex<ModesState>>,
) -> Result<Mode, String> {
    let modes = modes_state.inner().lock().map_err(|_| "failed to lock modes state".to_string())?;
    modes.update_mode(&id, name, icon_data_url, mode_type, matchers)
}

#[tauri::command]
fn delete_mode(
    id: String,
    modes_state: tauri::State<'_, Mutex<ModesState>>,
    state: tauri::State<'_, Mutex<FirewallState>>,
) -> Result<(), String> {
    let modes = modes_state.inner().lock().map_err(|_| "failed to lock modes state".to_string())?;
    let removed = modes.delete_mode(&id)?;
    if removed.active {
        teardown_mode(&modes, &state, &removed);
    }
    Ok(())
}

#[tauri::command]
fn set_mode_active(
    id: String,
    active: bool,
    modes_state: tauri::State<'_, Mutex<ModesState>>,
    state: tauri::State<'_, Mutex<FirewallState>>,
) -> Result<Mode, String> {
    let modes = modes_state.inner().lock().map_err(|_| "failed to lock modes state".to_string())?;

    if let Some(previous) = modes.active_mode() {
        if previous.id != id || !active {
            teardown_mode(&modes, &state, &previous);
        }
    }

    let updated = modes.set_active(&id, active)?;

    if active {
        if updated.mode_type == ModeType::BlockAllExcept {
            with_manager(&state, |manager| manager.set_default_deny(true))?;
        }
        reconcile_active_mode(&modes, &state, &HashSet::new());
    }

    Ok(updated)
}

#[tauri::command]
fn pick_executable_path(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app
        .dialog()
        .file()
        .add_filter("Executable", &["exe"])
        .blocking_pick_file()?;
    picked.into_path().ok().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn pick_icon_data_url(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app
        .dialog()
        .file()
        .add_filter("Image", &["png", "jpg", "jpeg", "ico", "webp", "svg"])
        .blocking_pick_file()?;
    let path = picked.into_path().ok()?;
    let bytes = std::fs::read(&path).ok()?;
    let mime = match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "ico" => "image/x-icon",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    };
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Some(format!("data:{mime};base64,{encoded}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    static TRACING_INIT: Once = Once::new();
    TRACING_INIT.call_once(|| {
        let _ = tracing_subscriber::fmt()
            .with_target(true)
            .with_ansi(false)
            .try_init();
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(FirewallState::init()))
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            app.manage(Mutex::new(ModesState::init(data_dir)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            block_application,
            unblock_application,
            is_application_blocked,
            list_firewall_rules,
            remove_all_firewall_rules,
            list_network_requests,
            get_dashboard_stats,
            list_modes,
            list_known_apps,
            create_mode,
            update_mode,
            delete_mode,
            set_mode_active,
            pick_executable_path,
            pick_icon_data_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
