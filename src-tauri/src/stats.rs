//! System-wide dashboard statistics: network throughput and active session counts.

use std::sync::Mutex;
use std::time::Instant;

use serde::Serialize;
use tracing::warn;

use crate::network::NetworkRequestDto;

#[derive(Debug, Clone, Serialize)]
pub struct DashboardStatsDto {
    pub throughput_mbps: f64,
    pub active_sessions: u32,
    pub blocked_today: u32,
}

struct ThroughputSample {
    at: Instant,
    total_bytes: u64,
}

static LAST_SAMPLE: Mutex<Option<ThroughputSample>> = Mutex::new(None);

/// Counts requests that represent an active session (i.e. have a remote endpoint).
pub fn active_sessions(requests: &[NetworkRequestDto]) -> u32 {
    requests.iter().filter(|r| r.remote_address.is_some()).count() as u32
}

/// Computes current combined upload+download throughput across active network
/// interfaces in megabits per second, based on the delta since the last call.
pub fn throughput_mbps() -> f64 {
    #[cfg(not(windows))]
    {
        0.0
    }

    #[cfg(windows)]
    {
        let total = match read_total_interface_bytes() {
            Ok(value) => value,
            Err(err) => {
                warn!(error = %err, "failed to read interface counters");
                return 0.0;
            }
        };

        let now = Instant::now();
        let mut guard = LAST_SAMPLE.lock().unwrap_or_else(|e| e.into_inner());
        let mbps = match guard.as_ref() {
            Some(previous) if total >= previous.total_bytes => {
                let elapsed = now.duration_since(previous.at).as_secs_f64();
                if elapsed <= 0.0 {
                    0.0
                } else {
                    let delta_bits = (total - previous.total_bytes) as f64 * 8.0;
                    delta_bits / elapsed / 1_000_000.0
                }
            }
            _ => 0.0,
        };
        *guard = Some(ThroughputSample { at: now, total_bytes: total });
        mbps
    }
}

#[cfg(windows)]
fn read_total_interface_bytes() -> Result<u64, String> {
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::NetworkManagement::IpHelper::{FreeMibTable, GetIfTable2, MIB_IF_TABLE2};
    use windows::Win32::NetworkManagement::Ndis::IfOperStatusUp;

    // Per RFC 2863 / ifdef.h; not exposed as a windows-rs constant.
    const IF_TYPE_SOFTWARE_LOOPBACK: u32 = 24;

    let mut table_ptr: *mut MIB_IF_TABLE2 = std::ptr::null_mut();
    // SAFETY: table_ptr is a valid out-pointer; GetIfTable2 allocates the table on success.
    let status = unsafe { GetIfTable2(&mut table_ptr) };
    if status != ERROR_SUCCESS {
        return Err(format!("GetIfTable2 failed with status 0x{:08X}", status.0));
    }
    if table_ptr.is_null() {
        return Ok(0);
    }

    // SAFETY: table_ptr was populated by GetIfTable2 and is valid until FreeMibTable.
    let table = unsafe { &*table_ptr };
    let count = table.NumEntries as usize;
    // SAFETY: the table has `count` contiguous rows in its flexible array member.
    let rows = unsafe { std::slice::from_raw_parts(table.Table.as_ptr(), count) };

    let total: u64 = rows
        .iter()
        .filter(|row| row.OperStatus == IfOperStatusUp && row.Type != IF_TYPE_SOFTWARE_LOOPBACK)
        .map(|row| row.InOctets + row.OutOctets)
        .sum();

    // SAFETY: table_ptr was allocated by GetIfTable2 and must be freed with FreeMibTable.
    unsafe { FreeMibTable(table_ptr as *const _) };

    Ok(total)
}
