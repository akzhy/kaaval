pub mod firewall;
pub mod modes;
mod network;
mod stats;

use std::collections::HashSet;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Mutex, Once};

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use tracing::{error, info, warn};

#[cfg(windows)]
use windows::Win32::UI::Shell::IsUserAnAdmin;

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

const ADMIN_REQUIRED_ERROR: &str = "ADMIN_REQUIRED";

#[derive(Debug, Clone, Serialize)]
struct AdminStatus {
    is_admin: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum ThemePreference {
    System,
    Dark,
    Light,
}

impl Default for ThemePreference {
    fn default() -> Self {
        Self::System
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct AppSettings {
    #[serde(default)]
    turn_off_modes_and_filters_on_close: bool,
    #[serde(default)]
    theme_preference: ThemePreference,
}

struct AppSettingsState {
    path: PathBuf,
    settings: AppSettings,
}

impl AppSettingsState {
    fn init(app_data_dir: PathBuf) -> Self {
        let path = app_data_dir.join("settings.json");
        let settings = std::fs::read_to_string(&path)
            .ok()
            .and_then(|text| serde_json::from_str::<AppSettings>(&text).ok())
            .unwrap_or_default();

        Self { path, settings }
    }

    fn save(&self) -> Result<(), String> {
        let text = serde_json::to_string_pretty(&self.settings)
            .map_err(|err| format!("failed to serialize settings: {err}"))?;
        std::fs::write(&self.path, text).map_err(|err| format!("failed to persist settings: {err}"))
    }
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

fn disable_all_enforcement_on_exit(
    modes_state: &ModesState,
    firewall_state: &tauri::State<'_, Mutex<FirewallState>>,
) {
    modes_state.deactivate_all();

    let _ = with_manager(firewall_state, |manager| {
        if let Err(err) = manager.set_default_deny(false) {
            warn!(error = %err, "failed to disable default-deny during app shutdown cleanup");
        }
        if let Err(err) = manager.remove_all_rules() {
            warn!(error = %err, "failed to remove managed firewall rules during app shutdown cleanup");
        }
        Ok(())
    });
}

fn is_running_as_admin() -> bool {
    #[cfg(windows)]
    {
        unsafe { IsUserAnAdmin().as_bool() }
    }

    #[cfg(not(windows))]
    {
        false
    }
}

fn admin_required_error(action: &str) -> String {
    return format!("{ADMIN_REQUIRED_ERROR}: administrator access is required for {action}");
}

fn quoted_ps(value: &str) -> String {
    return format!("'{}'", value.replace('\'', "''"));
}

fn relaunch_self_as_admin() -> Result<(), String> {
    let current_exe = std::env::current_exe()
        .map_err(|err| format!("failed to resolve current executable path: {err}"))?;

    let script = format!(
        "$p = Start-Process -FilePath {} -Verb RunAs -PassThru; if ($null -eq $p) {{ exit 1 }}",
        quoted_ps(&current_exe.to_string_lossy())
    );

    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .arg(script)
        .output()
        .map_err(|err| format!("failed to launch elevation prompt: {err}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        return Err("administrator relaunch was cancelled or failed".to_string());
    }
    Err(format!("administrator relaunch failed: {stderr}"))
}

#[tauri::command]
fn block_application(
    path: String,
    state: tauri::State<'_, Mutex<FirewallState>>,
) -> Result<FirewallResponse, String> {
    info!(path = %path, "blocking application");
    if !is_running_as_admin() {
        return Err(admin_required_error("blocking an application"));
    }
    with_manager(&state, |manager| manager.block_app(path))?;
    Ok(FirewallResponse { success: true })
}

#[tauri::command]
fn unblock_application(
    path: String,
    state: tauri::State<'_, Mutex<FirewallState>>,
) -> Result<FirewallResponse, String> {
    info!(path = %path, "unblocking application");
    if !is_running_as_admin() {
        return Err(admin_required_error("unblocking an application"));
    }
    with_manager(&state, |manager| manager.unblock_app(path))?;
    Ok(FirewallResponse { success: true })
}

#[tauri::command]
fn is_application_blocked(
    path: String,
    state: tauri::State<'_, Mutex<FirewallState>>,
) -> Result<bool, String> {
    info!(path = %path, "checking block status");
    with_manager(&state, |manager| manager.is_blocked(path))
}

#[tauri::command]
fn list_firewall_rules(
    state: tauri::State<'_, Mutex<FirewallState>>,
) -> Result<Vec<FirewallRuleDto>, String> {
    info!("listing managed firewall rules");
    let rules = with_manager(&state, |manager| manager.list_rules())?;
    Ok(rules.into_iter().map(Into::into).collect())
}

#[tauri::command]
fn remove_all_firewall_rules(
    state: tauri::State<'_, Mutex<FirewallState>>,
) -> Result<FirewallResponse, String> {
    info!("removing all managed firewall rules");
    if !is_running_as_admin() {
        return Err(admin_required_error("removing firewall rules"));
    }
    with_manager(&state, |manager| manager.remove_all_rules())?;
    Ok(FirewallResponse { success: true })
}

#[tauri::command]
fn list_network_requests(
    state: tauri::State<'_, Mutex<FirewallState>>,
    modes_state: tauri::State<'_, Mutex<ModesState>>,
) -> Result<Vec<NetworkRequestDto>, String> {
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
        let modes = modes_state
            .inner()
            .lock()
            .map_err(|_| "failed to lock modes state".to_string())?;
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
fn get_dashboard_stats(
    state: tauri::State<'_, Mutex<FirewallState>>,
) -> Result<DashboardStatsDto, String> {
    let requests = network::list_network_requests()?;
    let active_sessions = stats::active_sessions(&network::to_dto_with_blocking(
        requests,
        &Default::default(),
    ));
    let blocked_today = with_manager(&state, |manager| Ok(manager.blocked_today())).unwrap_or(0);

    Ok(DashboardStatsDto {
        throughput_mbps: stats::throughput_mbps(),
        active_sessions,
        blocked_today,
    })
}

/// Applies or removes WFP enforcement for one mode's matched app, based on its type.
fn apply_mode_enforcement(
    manager: &FirewallManager,
    mode_type: ModeType,
    path: &str,
    enabled: bool,
) {
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
fn reconcile_active_mode(
    modes_state: &ModesState,
    state: &tauri::State<'_, Mutex<FirewallState>>,
    observed: &HashSet<String>,
) {
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
            let path = modes_state
                .original_path_for(key)
                .unwrap_or_else(|| key.clone());
            apply_mode_enforcement(manager, mode.mode_type, &path, true);
        }
        for key in &to_remove {
            let path = modes_state
                .original_path_for(key)
                .unwrap_or_else(|| key.clone());
            apply_mode_enforcement(manager, mode.mode_type, &path, false);
        }
        Ok(())
    });
}

/// Tears down all enforcement (default-deny and/or per-app filters) for a mode.
fn teardown_mode(
    modes_state: &ModesState,
    state: &tauri::State<'_, Mutex<FirewallState>>,
    mode: &Mode,
) {
    let applied = modes_state.clear_applied();
    let _ = with_manager(state, |manager| {
        for key in &applied {
            let path = modes_state
                .original_path_for(key)
                .unwrap_or_else(|| key.clone());
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
    let modes = modes_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock modes state".to_string())?;
    Ok(modes.list_modes())
}

#[tauri::command]
fn list_known_apps(
    modes_state: tauri::State<'_, Mutex<ModesState>>,
) -> Result<Vec<KnownAppDto>, String> {
    let modes = modes_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock modes state".to_string())?;
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
    let modes = modes_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock modes state".to_string())?;
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
    let modes = modes_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock modes state".to_string())?;
    modes.update_mode(&id, name, icon_data_url, mode_type, matchers)
}

#[tauri::command]
fn delete_mode(
    id: String,
    modes_state: tauri::State<'_, Mutex<ModesState>>,
    state: tauri::State<'_, Mutex<FirewallState>>,
) -> Result<(), String> {
    let modes = modes_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock modes state".to_string())?;
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
    if !is_running_as_admin() {
        return Err(admin_required_error("changing active mode"));
    }

    let modes = modes_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock modes state".to_string())?;

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
fn get_admin_status() -> AdminStatus {
    AdminStatus {
        is_admin: is_running_as_admin(),
    }
}

#[tauri::command]
fn relaunch_as_admin(app: tauri::AppHandle) -> Result<FirewallResponse, String> {
    if is_running_as_admin() {
        return Ok(FirewallResponse { success: true });
    }

    relaunch_self_as_admin()?;
    app.exit(0);
    Ok(FirewallResponse { success: true })
}

#[tauri::command]
fn pick_executable_path(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = app
        .dialog()
        .file()
        .add_filter("Executable", &["exe"])
        .blocking_pick_file()?;
    picked
        .into_path()
        .ok()
        .map(|p| p.to_string_lossy().to_string())
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

#[tauri::command]
fn export_modes_file(content: String, destination: String) -> Result<(), String> {
    let path = std::path::Path::new(&destination);
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .map_err(|err| format!("failed to create parent directory: {err}"))?;
        }
    }
    std::fs::write(path, content).map_err(|err| format!("failed to write export file: {err}"))?;
    Ok(())
}

#[tauri::command]
fn get_app_settings(
    settings_state: tauri::State<'_, Mutex<AppSettingsState>>,
) -> Result<AppSettings, String> {
    let state = settings_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock settings state".to_string())?;
    Ok(state.settings.clone())
}

#[tauri::command]
fn set_turn_off_modes_and_filters_on_close(
    enabled: bool,
    settings_state: tauri::State<'_, Mutex<AppSettingsState>>,
) -> Result<AppSettings, String> {
    let mut state = settings_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock settings state".to_string())?;
    state.settings.turn_off_modes_and_filters_on_close = enabled;
    state.save()?;
    Ok(state.settings.clone())
}

#[tauri::command]
fn set_theme_preference(
    theme_preference: ThemePreference,
    settings_state: tauri::State<'_, Mutex<AppSettingsState>>,
) -> Result<AppSettings, String> {
    let mut state = settings_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock settings state".to_string())?;
    state.settings.theme_preference = theme_preference;
    state.save()?;
    Ok(state.settings.clone())
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
            app.manage(Mutex::new(ModesState::init(data_dir.clone())));
            app.manage(Mutex::new(AppSettingsState::init(data_dir)));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                let should_cleanup = app
                    .state::<Mutex<AppSettingsState>>()
                    .inner()
                    .lock()
                    .map(|state| state.settings.turn_off_modes_and_filters_on_close)
                    .unwrap_or(false);

                if !should_cleanup {
                    return;
                }

                info!("app close requested; disabling modes and removing managed firewall filters");
                let modes_state = app.state::<Mutex<ModesState>>();
                let firewall_state = app.state::<Mutex<FirewallState>>();
                match modes_state.inner().lock() {
                    Ok(modes) => disable_all_enforcement_on_exit(&modes, &firewall_state),
                    Err(_) => warn!("failed to lock modes state during app shutdown cleanup"),
                }
            }
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
            pick_icon_data_url,
            export_modes_file,
            get_app_settings,
            set_turn_off_modes_and_filters_on_close,
            set_theme_preference,
            get_admin_status,
            relaunch_as_admin
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
