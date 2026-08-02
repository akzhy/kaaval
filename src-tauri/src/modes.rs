//! Modes: user-defined allow/block profiles for groups of applications.
//!
//! Modes are persisted as JSON in the app data directory. Only one mode can be
//! active at a time; enforcement (translating matchers into WFP filters) is
//! handled by the caller (see `lib.rs`) which owns both this state and the
//! `FirewallManager`.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tracing::warn;
use uuid::Uuid;

use crate::network::normalize_path_key;

const MAX_KNOWN_APPS: usize = 300;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MatcherKind {
    Path,
    Directory,
    Name,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppMatcher {
    pub kind: MatcherKind,
    pub value: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModeType {
    BlockAllExcept,
    BlockThese,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mode {
    pub id: String,
    pub name: String,
    pub icon_data_url: Option<String>,
    pub mode_type: ModeType,
    pub matchers: Vec<AppMatcher>,
    #[serde(default)]
    pub active: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct KnownAppDto {
    pub path: String,
    pub name: String,
    pub last_seen_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct KnownApp {
    path: String,
    name: String,
    last_seen_secs: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct ModesFile {
    #[serde(default)]
    modes: Vec<Mode>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct KnownAppsFile {
    #[serde(default)]
    apps: Vec<KnownApp>,
}

/// Returns true if `path` (already normalized) matches this matcher.
pub fn matcher_matches(matcher: &AppMatcher, normalized_path: &str) -> bool {
    match matcher.kind {
        MatcherKind::Path => normalized_path == normalize_path_key(&matcher.value),
        MatcherKind::Directory => {
            let dir = normalize_path_key(&matcher.value);
            let dir = dir.trim_end_matches('\\');
            normalized_path == dir || normalized_path.starts_with(&format!("{dir}\\"))
        }
        MatcherKind::Name => {
            let file_name = Path::new(normalized_path)
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or("");
            let mut wanted = matcher.value.trim().to_ascii_lowercase();
            if !wanted.ends_with(".exe") {
                wanted.push_str(".exe");
            }
            file_name == wanted
        }
    }
}

pub struct ModesState {
    modes_path: PathBuf,
    known_apps_path: PathBuf,
    modes: Mutex<Vec<Mode>>,
    known_apps: Mutex<HashMap<String, KnownApp>>,
    applied_paths: Mutex<HashSet<String>>,
}

impl ModesState {
    pub fn init(app_data_dir: PathBuf) -> Self {
        let modes_path = app_data_dir.join("modes.json");
        let known_apps_path = app_data_dir.join("known_apps.json");

        if let Err(err) = fs::create_dir_all(&app_data_dir) {
            warn!(error = %err, "failed to create app data directory for modes");
        }

        let modes = load_json::<ModesFile>(&modes_path).unwrap_or_default().modes;
        let known_apps_list = load_json::<KnownAppsFile>(&known_apps_path).unwrap_or_default().apps;
        let known_apps = known_apps_list
            .into_iter()
            .map(|app| (normalize_path_key(&app.path), app))
            .collect();

        Self {
            modes_path,
            known_apps_path,
            modes: Mutex::new(modes),
            known_apps: Mutex::new(known_apps),
            applied_paths: Mutex::new(HashSet::new()),
        }
    }

    fn save_modes(&self, modes: &[Mode]) {
        let file = ModesFile { modes: modes.to_vec() };
        if let Err(err) = save_json(&self.modes_path, &file) {
            warn!(error = %err, "failed to persist modes");
        }
    }

    fn save_known_apps(&self, apps: &HashMap<String, KnownApp>) {
        let file = KnownAppsFile {
            apps: apps.values().cloned().collect(),
        };
        if let Err(err) = save_json(&self.known_apps_path, &file) {
            warn!(error = %err, "failed to persist known apps");
        }
    }

    pub fn list_modes(&self) -> Vec<Mode> {
        self.modes.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    pub fn active_mode(&self) -> Option<Mode> {
        self.modes
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .find(|m| m.active)
            .cloned()
    }

    /// Returns true if `normalized_path` is blocked as a side effect of the
    /// active mode's rules, independent of any manual per-app block.
    ///
    /// "Block these": blocked when the path matches a matcher.
    /// "Block all except": blocked when the path does *not* match a matcher
    /// (i.e. it isn't one of the allowed exceptions).
    pub fn is_blocked_by_active_mode(&self, normalized_path: &str) -> bool {
        let Some(mode) = self.active_mode() else {
            return false;
        };

        let matches = mode.matchers.iter().any(|m| matcher_matches(m, normalized_path));
        match mode.mode_type {
            ModeType::BlockThese => matches,
            ModeType::BlockAllExcept => !matches,
        }
    }

    pub fn create_mode(
        &self,
        name: String,
        icon_data_url: Option<String>,
        mode_type: ModeType,
        matchers: Vec<AppMatcher>,
    ) -> Mode {
        let mode = Mode {
            id: Uuid::new_v4().to_string(),
            name,
            icon_data_url,
            mode_type,
            matchers,
            active: false,
        };

        let mut modes = self.modes.lock().unwrap_or_else(|e| e.into_inner());
        modes.push(mode.clone());
        self.save_modes(&modes);
        mode
    }

    pub fn update_mode(
        &self,
        id: &str,
        name: String,
        icon_data_url: Option<String>,
        mode_type: ModeType,
        matchers: Vec<AppMatcher>,
    ) -> Result<Mode, String> {
        let mut modes = self.modes.lock().unwrap_or_else(|e| e.into_inner());
        let mode = modes
            .iter_mut()
            .find(|m| m.id == id)
            .ok_or_else(|| format!("mode not found: {id}"))?;
        mode.name = name;
        mode.icon_data_url = icon_data_url;
        mode.mode_type = mode_type;
        mode.matchers = matchers;
        let updated = mode.clone();
        self.save_modes(&modes);
        Ok(updated)
    }

    /// Removes a mode. Returns the removed mode so the caller can tear down
    /// enforcement if it was active.
    pub fn delete_mode(&self, id: &str) -> Result<Mode, String> {
        let mut modes = self.modes.lock().unwrap_or_else(|e| e.into_inner());
        let index = modes
            .iter()
            .position(|m| m.id == id)
            .ok_or_else(|| format!("mode not found: {id}"))?;
        let removed = modes.remove(index);
        self.save_modes(&modes);
        Ok(removed)
    }

    /// Marks `id` as the sole active mode (deactivating all others), or clears
    /// activation entirely when `active` is false.
    pub fn set_active(&self, id: &str, active: bool) -> Result<Mode, String> {
        let mut modes = self.modes.lock().unwrap_or_else(|e| e.into_inner());
        if !modes.iter().any(|m| m.id == id) {
            return Err(format!("mode not found: {id}"));
        }

        for mode in modes.iter_mut() {
            mode.active = active && mode.id == id;
        }

        let updated = modes.iter().find(|m| m.id == id).cloned().unwrap();
        self.save_modes(&modes);
        Ok(updated)
    }

    /// Records that an app was observed; returns true if this is a newly seen path.
    pub fn note_seen(&self, path: &str, name: &str) -> bool {
        if path.starts_with("<pid:") {
            return false;
        }

        let key = normalize_path_key(path);
        let now = current_epoch_secs();
        let mut apps = self.known_apps.lock().unwrap_or_else(|e| e.into_inner());
        let is_new = !apps.contains_key(&key);
        apps.insert(
            key,
            KnownApp {
                path: path.to_string(),
                name: name.to_string(),
                last_seen_secs: now,
            },
        );
        if is_new {
            self.save_known_apps(&apps);
        }
        is_new
    }

    pub fn list_known_apps(&self) -> Vec<KnownAppDto> {
        let apps = self.known_apps.lock().unwrap_or_else(|e| e.into_inner());
        let mut list: Vec<KnownAppDto> = apps
            .values()
            .map(|app| KnownAppDto {
                path: app.path.clone(),
                name: app.name.clone(),
                last_seen_secs: app.last_seen_secs,
            })
            .collect();
        list.sort_by(|a, b| b.last_seen_secs.cmp(&a.last_seen_secs));
        list.truncate(MAX_KNOWN_APPS);
        list
    }

    /// Looks up the original (non-normalized) path for a known app, given its
    /// normalized key. Used to pass a real filesystem path to firewall calls.
    pub fn original_path_for(&self, normalized: &str) -> Option<String> {
        self.known_apps
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(normalized)
            .map(|app| app.path.clone())
    }

    /// Computes the set of normalized paths (from known + currently observed
    /// apps) that match the given mode's matchers.
    pub fn resolve_matches(&self, mode: &Mode, observed_paths: &HashSet<String>) -> HashSet<String> {
        let known = self.known_apps.lock().unwrap_or_else(|e| e.into_inner());
        let mut candidates: HashSet<String> = known.keys().cloned().collect();
        candidates.extend(observed_paths.iter().cloned());

        candidates
            .into_iter()
            .filter(|path| mode.matchers.iter().any(|m| matcher_matches(m, path)))
            .collect()
    }

    /// Diffs `matched` against the previously applied path set, returning
    /// (paths to newly enforce, paths to stop enforcing), and updates state.
    pub fn diff_applied(&self, matched: HashSet<String>) -> (Vec<String>, Vec<String>) {
        let mut applied = self.applied_paths.lock().unwrap_or_else(|e| e.into_inner());
        let to_add: Vec<String> = matched.difference(&applied).cloned().collect();
        let to_remove: Vec<String> = applied.difference(&matched).cloned().collect();
        *applied = matched;
        (to_add, to_remove)
    }

    /// Clears the applied-paths tracking (used when a mode is deactivated).
    pub fn clear_applied(&self) -> Vec<String> {
        let mut applied = self.applied_paths.lock().unwrap_or_else(|e| e.into_inner());
        let previous = applied.iter().cloned().collect();
        applied.clear();
        previous
    }
}

fn current_epoch_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn load_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Option<T> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

fn save_json<T: Serialize>(path: &Path, value: &T) -> std::io::Result<()> {
    let text = serde_json::to_string_pretty(value)?;
    fs::write(path, text)
}
