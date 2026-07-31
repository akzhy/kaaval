mod firewall;
mod network;
mod stats;

use std::collections::HashSet;
use std::sync::{Mutex, Once};

use serde::Serialize;
use tracing::{error, info, warn};

use firewall::{FirewallManager, FirewallRuleDto};
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
fn list_network_requests(state: tauri::State<'_, Mutex<FirewallState>>) -> Result<Vec<NetworkRequestDto>, String> {
    info!("listing live network requests");
    let requests = network::list_network_requests()?;

    let distinct_paths = requests
        .iter()
        .map(|r| r.app_path.clone())
        .filter(|p| !p.starts_with("<pid:"))
        .collect::<HashSet<_>>();

    let blocked_paths = with_manager(&state, |manager| {
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
        .manage(Mutex::new(FirewallState::init()))
        .invoke_handler(tauri::generate_handler![
            block_application,
            unblock_application,
            is_application_blocked,
            list_firewall_rules,
            remove_all_firewall_rules,
            list_network_requests,
            get_dashboard_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
