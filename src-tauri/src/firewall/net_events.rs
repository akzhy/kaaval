//! Tracks blocked connection attempts via the WFP net event stream so the UI can
//! show a "blocked today" counter without polling filter state.

use std::collections::HashSet;
use std::ffi::c_void;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use tracing::{debug, warn};
use windows::core::GUID;
use windows::Win32::Foundation::{ERROR_SUCCESS, HANDLE};
use windows::Win32::NetworkManagement::WindowsFilteringPlatform::{
    FwpmEngineSetOption0, FwpmNetEventSubscribe4, FWPM_ENGINE_COLLECT_NET_EVENTS, FWPM_NET_EVENT5,
    FWPM_NET_EVENT_SUBSCRIPTION0, FWPM_NET_EVENT_TYPE_CLASSIFY_DROP, FWP_UINT32, FWP_VALUE0,
    FWP_VALUE0_0,
};

use super::engine::EngineHandle;
use crate::network::normalize_path_key;

static COUNTERS: OnceLock<NetEventCounters> = OnceLock::new();

pub fn counters() -> &'static NetEventCounters {
    COUNTERS.get_or_init(NetEventCounters::new)
}

/// Daily counter of connection attempts blocked for paths we are currently managing.
pub struct NetEventCounters {
    count: AtomicU32,
    day_marker: AtomicU64,
    tracked_paths: Mutex<HashSet<String>>,
}

impl NetEventCounters {
    fn new() -> Self {
        Self {
            count: AtomicU32::new(0),
            day_marker: AtomicU64::new(current_day_marker()),
            tracked_paths: Mutex::new(HashSet::new()),
        }
    }

    /// Marks a normalized executable path as currently blocked (or not) so that
    /// matching drop events are attributed to our managed rules.
    pub fn set_tracked(&self, path_key: String, tracked: bool) {
        let mut set = self.tracked_paths.lock().unwrap_or_else(|e| e.into_inner());
        if tracked {
            set.insert(path_key);
        } else {
            set.remove(&path_key);
        }
    }

    fn note_drop(&self, path_key: &str) {
        let is_tracked = self
            .tracked_paths
            .lock()
            .map(|set| set.contains(path_key))
            .unwrap_or(false);
        if !is_tracked {
            return;
        }
        self.roll_over_if_needed();
        self.count.fetch_add(1, Ordering::Relaxed);
    }

    fn roll_over_if_needed(&self) {
        let today = current_day_marker();
        let previous = self.day_marker.swap(today, Ordering::Relaxed);
        if previous != today {
            self.count.store(0, Ordering::Relaxed);
        }
    }

    pub fn blocked_today(&self) -> u32 {
        self.roll_over_if_needed();
        self.count.load(Ordering::Relaxed)
    }
}

fn current_day_marker() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() / 86_400)
        .unwrap_or(0)
}

/// Subscribes to WFP network events so blocked connection attempts can be counted.
/// Best-effort: failures are logged and otherwise ignored so the rest of the
/// firewall backend keeps working without this feature.
pub fn start_monitoring(engine: &EngineHandle) {
    let enable = FWP_VALUE0 {
        r#type: FWP_UINT32,
        Anonymous: FWP_VALUE0_0 { uint32: 1 },
    };
    // SAFETY: engine handle is valid and `enable` lives for the duration of this call.
    let status =
        unsafe { FwpmEngineSetOption0(engine.raw(), FWPM_ENGINE_COLLECT_NET_EVENTS, &enable) };
    if status != ERROR_SUCCESS.0 {
        warn!(status = format!("0x{status:08X}"), "failed to enable WFP net event collection");
        return;
    }

    let subscription = FWPM_NET_EVENT_SUBSCRIPTION0 {
        enumTemplate: std::ptr::null_mut(),
        flags: 0,
        sessionKey: GUID::zeroed(),
    };
    let mut events_handle = HANDLE::default();
    // SAFETY: subscription and callback are valid for the duration of this call, and
    // events_handle is a valid out-pointer for the returned subscription handle.
    let status = unsafe {
        FwpmNetEventSubscribe4(
            engine.raw(),
            &subscription,
            Some(net_event_callback),
            None,
            &mut events_handle,
        )
    };
    if status != ERROR_SUCCESS.0 {
        warn!(status = format!("0x{status:08X}"), "failed to subscribe to WFP net events");
        return;
    }

    // Subscription is intentionally kept open for the process lifetime; the OS
    // reclaims the handle on exit.
    debug!("subscribed to WFP net events for blocked-connection tracking");
}

unsafe extern "system" fn net_event_callback(_context: *mut c_void, event: *const FWPM_NET_EVENT5) {
    if event.is_null() {
        return;
    }
    // SAFETY: WFP guarantees `event` is valid for the duration of this callback.
    let event = &*event;
    if event.r#type != FWPM_NET_EVENT_TYPE_CLASSIFY_DROP {
        return;
    }

    let blob = &event.header.appId;
    if blob.data.is_null() || blob.size < 2 {
        return;
    }

    // SAFETY: appId blobs from WFP are null-terminated UTF-16 device paths.
    let units = std::slice::from_raw_parts(blob.data as *const u16, (blob.size as usize) / 2);
    let raw_path = String::from_utf16_lossy(units);
    let path = raw_path.trim_end_matches('\0');
    if path.is_empty() {
        return;
    }

    counters().note_drop(&normalize_path_key(path));
}
