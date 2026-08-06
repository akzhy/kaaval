//! Windows Filtering Platform backend for application-level outbound blocking.
//!
//! This module uses ALE connect layers so blocking happens at connection authorization
//! time for outbound traffic and can be scoped precisely to a single executable.

use std::path::{Path, PathBuf};

#[cfg(windows)]
use windows::Win32::NetworkManagement::WindowsFilteringPlatform::{
    FWP_ACTION_BLOCK, FWP_ACTION_PERMIT,
};

pub mod error;
pub mod types;

#[cfg(windows)]
mod app_id;
#[cfg(windows)]
mod engine;
#[cfg(windows)]
mod filters;
#[cfg(windows)]
pub mod net_events;
#[cfg(windows)]
mod provider;

pub use error::{FirewallError, Result};
pub use types::{FirewallRule, FirewallRuleDto};

/// High-level manager that keeps a persistent WFP engine handle.
pub struct FirewallManager {
    #[cfg(windows)]
    engine: engine::EngineHandle,
}

impl FirewallManager {
    /// Creates a new manager with a persistent engine handle.
    ///
    /// Provider/sublayer creation is performed lazily by mutating operations
    /// so application startup does not fail in non-elevated contexts.
    pub fn new() -> Result<Self> {
        #[cfg(not(windows))]
        {
            return Err(FirewallError::UnsupportedPlatform);
        }

        #[cfg(windows)]
        {
            let engine = engine::EngineHandle::open()?;
            let manager = Self { engine };
            net_events::start_monitoring(&manager.engine);
            manager.seed_blocked_tracking();
            Ok(manager)
        }
    }

    /// Seeds the blocked-today tracker with executables that already have rules
    /// so events for pre-existing blocks are still counted after a restart.
    #[cfg(windows)]
    fn seed_blocked_tracking(&self) {
        if let Ok(rules) = self.list_rules() {
            for rule in rules {
                let key = crate::network::normalize_path_key(&rule.exe_path.to_string_lossy());
                net_events::counters().set_tracked(key, true);
            }
        }
    }

    /// Blocks outbound TCP/UDP on IPv4/IPv6 for the provided executable path.
    pub fn block_app<P: AsRef<Path>>(&self, exe: P) -> Result<()> {
        #[cfg(not(windows))]
        {
            let _ = exe;
            return Err(FirewallError::UnsupportedPlatform);
        }

        #[cfg(windows)]
        {
            let exe_path = normalize_exe_path(exe)?;
            let exe_str = exe_path
                .to_str()
                .ok_or_else(|| FirewallError::InvalidUtf16Path(exe_path.clone()))?;

            let tx = self.engine.transaction()?;
            provider::ensure_provider_and_sublayer(&self.engine)?;
            let app_id = app_id::AppIdBlob::from_executable_path(&exe_path)?;
            filters::add_block_filters(&self.engine, exe_str, &app_id)?;
            tx.commit()?;
            net_events::counters().set_tracked(crate::network::normalize_path_key(exe_str), true);
            Ok(())
        }
    }

    /// Removes all managed block filters for the provided executable.
    pub fn unblock_app<P: AsRef<Path>>(&self, exe: P) -> Result<()> {
        #[cfg(not(windows))]
        {
            let _ = exe;
            return Err(FirewallError::UnsupportedPlatform);
        }

        #[cfg(windows)]
        {
            let exe_path = normalize_exe_path(exe)?;
            let exe_str = exe_path
                .to_str()
                .ok_or_else(|| FirewallError::InvalidUtf16Path(exe_path.clone()))?;

            let tx = self.engine.transaction()?;
            filters::delete_block_filters(&self.engine, exe_str)?;
            tx.commit()?;
            net_events::counters().set_tracked(crate::network::normalize_path_key(exe_str), false);
            Ok(())
        }
    }

    /// Returns true when all expected protocol/layer filters exist for this executable.
    pub fn is_blocked<P: AsRef<Path>>(&self, exe: P) -> Result<bool> {
        #[cfg(not(windows))]
        {
            let _ = exe;
            return Err(FirewallError::UnsupportedPlatform);
        }

        #[cfg(windows)]
        {
            let exe_path = normalize_exe_path(exe)?;
            let exe_str = exe_path
                .to_str()
                .ok_or_else(|| FirewallError::InvalidUtf16Path(exe_path.clone()))?;

            filters::are_all_filters_present(&self.engine, exe_str)
        }
    }

    /// Lists all WFP filters created by this application's provider.
    pub fn list_rules(&self) -> Result<Vec<FirewallRule>> {
        #[cfg(not(windows))]
        {
            return Err(FirewallError::UnsupportedPlatform);
        }

        #[cfg(windows)]
        {
            filters::list_provider_rules(&self.engine)
        }
    }

    /// Returns the count of connection attempts blocked by managed rules since midnight (UTC).
    #[cfg(windows)]
    pub fn blocked_today(&self) -> u32 {
        net_events::counters().blocked_today()
    }

    #[cfg(not(windows))]
    pub fn blocked_today(&self) -> u32 {
        0
    }

    /// Removes all WFP filters owned by this application's provider.
    pub fn remove_all_rules(&self) -> Result<()> {
        #[cfg(not(windows))]
        {
            return Err(FirewallError::UnsupportedPlatform);
        }

        #[cfg(windows)]
        {
            let tx = self.engine.transaction()?;
            filters::delete_all_provider_filters(&self.engine)?;
            tx.commit()
        }
    }

    /// Enables or disables the default-deny ("block all") base filters used by
    /// "block all except" modes. Exceptions are layered on top via `set_mode_permit`.
    pub fn set_default_deny(&self, enabled: bool) -> Result<()> {
        #[cfg(not(windows))]
        {
            let _ = enabled;
            return Err(FirewallError::UnsupportedPlatform);
        }

        #[cfg(windows)]
        {
            let tx = self.engine.transaction()?;
            if enabled {
                provider::ensure_provider_and_sublayer(&self.engine)?;
                filters::delete_tagged_blanket_filters(&self.engine, MODE_TAG_DEFAULT_DENY)?;
                filters::add_tagged_blanket_filters(
                    &self.engine,
                    MODE_TAG_DEFAULT_DENY,
                    FWP_ACTION_BLOCK,
                    WEIGHT_DEFAULT_DENY,
                )?;
            } else {
                filters::delete_tagged_blanket_filters(&self.engine, MODE_TAG_DEFAULT_DENY)?;
            }
            tx.commit()
        }
    }

    /// Enables or disables high-priority permit filters for local/non-internet
    /// destinations so app and mode blocks only affect internet-bound traffic.
    pub fn set_local_traffic_allow(&self, enabled: bool) -> Result<()> {
        #[cfg(not(windows))]
        {
            let _ = enabled;
            return Err(FirewallError::UnsupportedPlatform);
        }

        #[cfg(windows)]
        {
            let tx = self.engine.transaction()?;
            if enabled {
                provider::ensure_provider_and_sublayer(&self.engine)?;
                filters::delete_tagged_local_permit_filters(
                    &self.engine,
                    MODE_TAG_LOCAL_TRAFFIC_ALLOW,
                )?;
                filters::add_tagged_local_permit_filters(
                    &self.engine,
                    MODE_TAG_LOCAL_TRAFFIC_ALLOW,
                    WEIGHT_LOCAL_TRAFFIC_ALLOW,
                )?;
            } else {
                filters::delete_tagged_local_permit_filters(
                    &self.engine,
                    MODE_TAG_LOCAL_TRAFFIC_ALLOW,
                )?;
            }
            tx.commit()
        }
    }

    /// Adds or removes a permit-exception filter for one executable, used by
    /// "block all except" modes to carve out allowed apps above the default deny.
    pub fn set_mode_permit<P: AsRef<Path>>(&self, exe: P, enabled: bool) -> Result<()> {
        #[cfg(not(windows))]
        {
            let _ = (exe, enabled);
            return Err(FirewallError::UnsupportedPlatform);
        }

        #[cfg(windows)]
        {
            let exe_path = normalize_exe_path(exe)?;
            let exe_str = exe_path
                .to_str()
                .ok_or_else(|| FirewallError::InvalidUtf16Path(exe_path.clone()))?;

            let tx = self.engine.transaction()?;
            if enabled {
                provider::ensure_provider_and_sublayer(&self.engine)?;
                let app_id = app_id::AppIdBlob::from_executable_path(&exe_path)?;
                filters::add_tagged_app_filters(
                    &self.engine,
                    MODE_TAG_PERMIT,
                    exe_str,
                    &app_id,
                    FWP_ACTION_PERMIT,
                    WEIGHT_MODE_PERMIT,
                )?;
            } else {
                filters::delete_tagged_app_filters(&self.engine, MODE_TAG_PERMIT, exe_str)?;
            }
            tx.commit()
        }
    }

    /// Adds or removes a mode-owned block filter for one executable, used by
    /// "block these" modes. Independent from manual per-app blocks.
    pub fn set_mode_block<P: AsRef<Path>>(&self, exe: P, enabled: bool) -> Result<()> {
        #[cfg(not(windows))]
        {
            let _ = (exe, enabled);
            return Err(FirewallError::UnsupportedPlatform);
        }

        #[cfg(windows)]
        {
            let exe_path = normalize_exe_path(exe)?;
            let exe_str = exe_path
                .to_str()
                .ok_or_else(|| FirewallError::InvalidUtf16Path(exe_path.clone()))?;

            let tx = self.engine.transaction()?;
            if enabled {
                provider::ensure_provider_and_sublayer(&self.engine)?;
                let app_id = app_id::AppIdBlob::from_executable_path(&exe_path)?;
                filters::add_tagged_app_filters(
                    &self.engine,
                    MODE_TAG_BLOCK,
                    exe_str,
                    &app_id,
                    FWP_ACTION_BLOCK,
                    WEIGHT_MODE_BLOCK,
                )?;
            } else {
                filters::delete_tagged_app_filters(&self.engine, MODE_TAG_BLOCK, exe_str)?;
            }
            tx.commit()
        }
    }
}

#[cfg(windows)]
const MODE_TAG_DEFAULT_DENY: &str = "default-deny";
#[cfg(windows)]
const MODE_TAG_PERMIT: &str = "mode-permit";
#[cfg(windows)]
const MODE_TAG_BLOCK: &str = "mode-block";
#[cfg(windows)]
const MODE_TAG_LOCAL_TRAFFIC_ALLOW: &str = "local-traffic-allow";
#[cfg(windows)]
const WEIGHT_DEFAULT_DENY: u8 = 0x01;
#[cfg(windows)]
const WEIGHT_MODE_PERMIT: u8 = 0x08;
#[cfg(windows)]
const WEIGHT_MODE_BLOCK: u8 = 0x0f;
#[cfg(windows)]
const WEIGHT_LOCAL_TRAFFIC_ALLOW: u8 = 0x10;

#[cfg(windows)]
fn normalize_exe_path<P: AsRef<Path>>(exe: P) -> Result<PathBuf> {
    let p = exe.as_ref();
    if p.as_os_str().is_empty() {
        return Err(FirewallError::InvalidPath("path is empty".to_string()));
    }

    let canonical =
        std::fs::canonicalize(p).map_err(|_| FirewallError::ExecutableNotFound(p.to_path_buf()))?;

    if !canonical.is_file() {
        return Err(FirewallError::InvalidPath(format!(
            "not a file: {}",
            canonical.display()
        )));
    }

    Ok(canonical)
}
