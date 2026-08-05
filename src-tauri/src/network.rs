use std::collections::HashMap;
use std::ffi::c_void;
use std::net::{Ipv4Addr, Ipv6Addr};

use serde::{Deserialize, Serialize};
use tracing::debug;
use windows::core::PWSTR;
use windows::Win32::Foundation::{BOOL, CloseHandle, HANDLE};
use windows::Win32::NetworkManagement::IpHelper::{
    GetExtendedTcpTable, GetExtendedUdpTable, MIB_TCP6ROW_OWNER_PID, MIB_TCP6TABLE_OWNER_PID,
    MIB_TCPROW_OWNER_PID, MIB_TCPTABLE_OWNER_PID, MIB_UDP6ROW_OWNER_PID,
    MIB_UDP6TABLE_OWNER_PID, MIB_UDPROW_OWNER_PID, MIB_UDPTABLE_OWNER_PID,
    TCP_TABLE_OWNER_PID_ALL, UDP_TABLE_OWNER_PID,
};
use windows::Win32::Networking::WinSock::{AF_INET, AF_INET6};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkRequestDto {
    pub app_path: String,
    pub app_name: String,
    pub pid: u32,
    pub protocol: String,
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: Option<String>,
    pub remote_port: Option<u16>,
    pub state: Option<String>,
    pub blocked: bool,
}

#[derive(Debug, Clone)]
pub(crate) struct BaseRecord {
    pub(crate) app_path: String,
    pub(crate) app_name: String,
    pub(crate) pid: u32,
    pub(crate) protocol: String,
    pub(crate) local_address: String,
    pub(crate) local_port: u16,
    pub(crate) remote_address: Option<String>,
    pub(crate) remote_port: Option<u16>,
    pub(crate) state: Option<String>,
}

pub(crate) fn list_network_requests() -> Result<Vec<BaseRecord>, String> {
    #[cfg(not(windows))]
    {
        return Err("network activity listing is only supported on Windows".to_string());
    }

    #[cfg(windows)]
    {
        let mut proc_cache: HashMap<u32, String> = HashMap::new();
        let mut rows = Vec::new();

        rows.extend(read_tcp_v4(&mut proc_cache)?);
        rows.extend(read_tcp_v6(&mut proc_cache)?);
        rows.extend(read_udp_v4(&mut proc_cache)?);
        rows.extend(read_udp_v6(&mut proc_cache)?);

        Ok(rows)
    }
}

#[cfg(windows)]
fn read_tcp_v4(proc_cache: &mut HashMap<u32, String>) -> Result<Vec<BaseRecord>, String> {
    let mut size = 0u32;
    // SAFETY: First call probes required buffer size with null buffer as documented.
    let _ = unsafe {
        GetExtendedTcpTable(
            None,
            &mut size,
            BOOL(0),
            AF_INET.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        )
    };

    if size == 0 {
        return Ok(Vec::new());
    }

    let mut buffer = vec![0u8; size as usize];
    // SAFETY: Buffer is allocated at requested size and pointer is valid for writes.
    let status = unsafe {
        GetExtendedTcpTable(
            Some(buffer.as_mut_ptr() as *mut c_void),
            &mut size,
            BOOL(0),
            AF_INET.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        )
    };
    if status != 0 {
        return Err(format!("GetExtendedTcpTable(AF_INET) failed with status 0x{status:08X}"));
    }

    // SAFETY: Buffer now contains a valid MIB_TCPTABLE_OWNER_PID structure.
    let table = unsafe { &*(buffer.as_ptr() as *const MIB_TCPTABLE_OWNER_PID) };
    // SAFETY: table points to dwNumEntries contiguous rows in its flexible array.
    let rows = unsafe {
        std::slice::from_raw_parts(table.table.as_ptr(), table.dwNumEntries as usize)
    };

    Ok(rows
        .iter()
        .map(|row| tcp_v4_record(row, proc_cache))
        .collect())
}

#[cfg(windows)]
fn read_tcp_v6(proc_cache: &mut HashMap<u32, String>) -> Result<Vec<BaseRecord>, String> {
    let mut size = 0u32;
    // SAFETY: First call probes required buffer size with null buffer as documented.
    let _ = unsafe {
        GetExtendedTcpTable(
            None,
            &mut size,
            BOOL(0),
            AF_INET6.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        )
    };

    if size == 0 {
        return Ok(Vec::new());
    }

    let mut buffer = vec![0u8; size as usize];
    // SAFETY: Buffer is allocated at requested size and pointer is valid for writes.
    let status = unsafe {
        GetExtendedTcpTable(
            Some(buffer.as_mut_ptr() as *mut c_void),
            &mut size,
            BOOL(0),
            AF_INET6.0 as u32,
            TCP_TABLE_OWNER_PID_ALL,
            0,
        )
    };
    if status != 0 {
        return Err(format!("GetExtendedTcpTable(AF_INET6) failed with status 0x{status:08X}"));
    }

    // SAFETY: Buffer now contains a valid MIB_TCP6TABLE_OWNER_PID structure.
    let table = unsafe { &*(buffer.as_ptr() as *const MIB_TCP6TABLE_OWNER_PID) };
    // SAFETY: table points to dwNumEntries contiguous rows in its flexible array.
    let rows = unsafe {
        std::slice::from_raw_parts(table.table.as_ptr(), table.dwNumEntries as usize)
    };

    Ok(rows
        .iter()
        .map(|row| tcp_v6_record(row, proc_cache))
        .collect())
}

#[cfg(windows)]
fn read_udp_v4(proc_cache: &mut HashMap<u32, String>) -> Result<Vec<BaseRecord>, String> {
    let mut size = 0u32;
    // SAFETY: First call probes required buffer size with null buffer as documented.
    let _ = unsafe {
        GetExtendedUdpTable(
            None,
            &mut size,
            BOOL(0),
            AF_INET.0 as u32,
            UDP_TABLE_OWNER_PID,
            0,
        )
    };

    if size == 0 {
        return Ok(Vec::new());
    }

    let mut buffer = vec![0u8; size as usize];
    // SAFETY: Buffer is allocated at requested size and pointer is valid for writes.
    let status = unsafe {
        GetExtendedUdpTable(
            Some(buffer.as_mut_ptr() as *mut c_void),
            &mut size,
            BOOL(0),
            AF_INET.0 as u32,
            UDP_TABLE_OWNER_PID,
            0,
        )
    };
    if status != 0 {
        return Err(format!("GetExtendedUdpTable(AF_INET) failed with status 0x{status:08X}"));
    }

    // SAFETY: Buffer now contains a valid MIB_UDPTABLE_OWNER_PID structure.
    let table = unsafe { &*(buffer.as_ptr() as *const MIB_UDPTABLE_OWNER_PID) };
    // SAFETY: table points to dwNumEntries contiguous rows in its flexible array.
    let rows = unsafe {
        std::slice::from_raw_parts(table.table.as_ptr(), table.dwNumEntries as usize)
    };

    Ok(rows
        .iter()
        .map(|row| udp_v4_record(row, proc_cache))
        .collect())
}

#[cfg(windows)]
fn read_udp_v6(proc_cache: &mut HashMap<u32, String>) -> Result<Vec<BaseRecord>, String> {
    let mut size = 0u32;
    // SAFETY: First call probes required buffer size with null buffer as documented.
    let _ = unsafe {
        GetExtendedUdpTable(
            None,
            &mut size,
            BOOL(0),
            AF_INET6.0 as u32,
            UDP_TABLE_OWNER_PID,
            0,
        )
    };

    if size == 0 {
        return Ok(Vec::new());
    }

    let mut buffer = vec![0u8; size as usize];
    // SAFETY: Buffer is allocated at requested size and pointer is valid for writes.
    let status = unsafe {
        GetExtendedUdpTable(
            Some(buffer.as_mut_ptr() as *mut c_void),
            &mut size,
            BOOL(0),
            AF_INET6.0 as u32,
            UDP_TABLE_OWNER_PID,
            0,
        )
    };
    if status != 0 {
        return Err(format!("GetExtendedUdpTable(AF_INET6) failed with status 0x{status:08X}"));
    }

    // SAFETY: Buffer now contains a valid MIB_UDP6TABLE_OWNER_PID structure.
    let table = unsafe { &*(buffer.as_ptr() as *const MIB_UDP6TABLE_OWNER_PID) };
    // SAFETY: table points to dwNumEntries contiguous rows in its flexible array.
    let rows = unsafe {
        std::slice::from_raw_parts(table.table.as_ptr(), table.dwNumEntries as usize)
    };

    Ok(rows
        .iter()
        .map(|row| udp_v6_record(row, proc_cache))
        .collect())
}

#[cfg(windows)]
fn tcp_v4_record(row: &MIB_TCPROW_OWNER_PID, proc_cache: &mut HashMap<u32, String>) -> BaseRecord {
    let pid = row.dwOwningPid;
    let app_path = process_path_for_pid(pid, proc_cache);
    let app_name = app_name_from_path(&app_path);

    BaseRecord {
        app_path,
        app_name,
        pid,
        protocol: "TCP4".to_string(),
        local_address: Ipv4Addr::from(row.dwLocalAddr.to_be_bytes()).to_string(),
        local_port: port_from_dword(row.dwLocalPort),
        remote_address: Some(Ipv4Addr::from(row.dwRemoteAddr.to_be_bytes()).to_string()),
        remote_port: Some(port_from_dword(row.dwRemotePort)),
        state: Some(tcp_state_name(row.dwState)),
    }
}

#[cfg(windows)]
fn tcp_v6_record(row: &MIB_TCP6ROW_OWNER_PID, proc_cache: &mut HashMap<u32, String>) -> BaseRecord {
    let pid = row.dwOwningPid;
    let app_path = process_path_for_pid(pid, proc_cache);
    let app_name = app_name_from_path(&app_path);

    BaseRecord {
        app_path,
        app_name,
        pid,
        protocol: "TCP6".to_string(),
        local_address: Ipv6Addr::from(row.ucLocalAddr).to_string(),
        local_port: port_from_dword(row.dwLocalPort),
        remote_address: Some(Ipv6Addr::from(row.ucRemoteAddr).to_string()),
        remote_port: Some(port_from_dword(row.dwRemotePort)),
        state: Some(tcp_state_name(row.dwState)),
    }
}

#[cfg(windows)]
fn udp_v4_record(row: &MIB_UDPROW_OWNER_PID, proc_cache: &mut HashMap<u32, String>) -> BaseRecord {
    let pid = row.dwOwningPid;
    let app_path = process_path_for_pid(pid, proc_cache);
    let app_name = app_name_from_path(&app_path);

    BaseRecord {
        app_path,
        app_name,
        pid,
        protocol: "UDP4".to_string(),
        local_address: Ipv4Addr::from(row.dwLocalAddr.to_be_bytes()).to_string(),
        local_port: port_from_dword(row.dwLocalPort),
        remote_address: None,
        remote_port: None,
        state: None,
    }
}

#[cfg(windows)]
fn udp_v6_record(row: &MIB_UDP6ROW_OWNER_PID, proc_cache: &mut HashMap<u32, String>) -> BaseRecord {
    let pid = row.dwOwningPid;
    let app_path = process_path_for_pid(pid, proc_cache);
    let app_name = app_name_from_path(&app_path);

    BaseRecord {
        app_path,
        app_name,
        pid,
        protocol: "UDP6".to_string(),
        local_address: Ipv6Addr::from(row.ucLocalAddr).to_string(),
        local_port: port_from_dword(row.dwLocalPort),
        remote_address: None,
        remote_port: None,
        state: None,
    }
}

#[cfg(windows)]
fn process_path_for_pid(pid: u32, cache: &mut HashMap<u32, String>) -> String {
    if let Some(value) = cache.get(&pid) {
        return value.clone();
    }

    let path = process_path_for_pid_impl(pid).unwrap_or_else(|| format!("<pid:{pid}>"));
    cache.insert(pid, path.clone());
    path
}

#[cfg(windows)]
fn process_path_for_pid_impl(pid: u32) -> Option<String> {
    // SAFETY: OpenProcess is called with query-only rights and a concrete PID.
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }.ok()?;
    let _guard = ProcessHandleGuard(handle);

    let mut cap = 32768u32;
    let mut buffer = vec![0u16; cap as usize];
    // SAFETY: handle is valid, buffer is writable, and cap is set to buffer length.
    let status = unsafe {
        QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            PWSTR(buffer.as_mut_ptr()),
            &mut cap,
        )
    };
    if status.is_err() {
        return None;
    }

    String::from_utf16(&buffer[..cap as usize]).ok()
}

#[cfg(windows)]
struct ProcessHandleGuard(HANDLE);

#[cfg(windows)]
impl Drop for ProcessHandleGuard {
    fn drop(&mut self) {
        // SAFETY: handle was returned by OpenProcess and should be closed once.
        let _ = unsafe { CloseHandle(self.0) };
    }
}

#[cfg(windows)]
fn port_from_dword(value: u32) -> u16 {
    u16::from_be((value & 0xFFFF) as u16)
}

#[cfg(windows)]
fn app_name_from_path(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

#[cfg(windows)]
fn tcp_state_name(state: u32) -> String {
    match state {
        1 => "CLOSED",
        2 => "LISTEN",
        3 => "SYN_SENT",
        4 => "SYN_RCVD",
        5 => "ESTABLISHED",
        6 => "FIN_WAIT1",
        7 => "FIN_WAIT2",
        8 => "CLOSE_WAIT",
        9 => "CLOSING",
        10 => "LAST_ACK",
        11 => "TIME_WAIT",
        12 => "DELETE_TCB",
        _ => "UNKNOWN",
    }
    .to_string()
}

pub(crate) fn to_dto_with_blocking(base: Vec<BaseRecord>, blocked_paths: &std::collections::HashSet<String>) -> Vec<NetworkRequestDto> {
    debug!(count = base.len(), "building network request dto list");
    base.into_iter()
        .map(|row| {
            let blocked = blocked_paths.contains(&normalize_path_key(&row.app_path));
            NetworkRequestDto {
                app_path: row.app_path,
                app_name: row.app_name,
                pid: row.pid,
                protocol: row.protocol,
                local_address: row.local_address,
                local_port: row.local_port,
                remote_address: row.remote_address,
                remote_port: row.remote_port,
                state: row.state,
                blocked,
            }
        })
        .collect()
}

pub(crate) fn normalize_path_key(path: &str) -> String {
    let mut s = path.trim().replace('/', "\\");
    if let Some(stripped) = s.strip_prefix("\\\\?\\") {
        s = stripped.to_string();
    }
    s.to_ascii_lowercase()
}
