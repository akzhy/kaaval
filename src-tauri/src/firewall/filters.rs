use std::path::PathBuf;
use std::ptr::null_mut;

use tracing::debug;
use uuid::Uuid;
use windows::core::{GUID, PWSTR};
use windows::Win32::Foundation::{ERROR_SUCCESS, HANDLE};
use windows::Win32::NetworkManagement::WindowsFilteringPlatform::{
    FwpmFilterAdd0, FwpmFilterCreateEnumHandle0, FwpmFilterDeleteByKey0,
    FwpmFilterDestroyEnumHandle0, FwpmFilterEnum0, FwpmFilterGetByKey0, FwpmFreeMemory0,
    FWPM_ACTION0, FWPM_CONDITION_ALE_APP_ID, FWPM_CONDITION_FLAGS, FWPM_CONDITION_IP_PROTOCOL,
    FWPM_DISPLAY_DATA0, FWPM_FILTER0, FWPM_FILTER_CONDITION0, FWPM_FILTER_ENUM_TEMPLATE0,
    FWPM_FILTER_FLAGS, FWPM_FILTER_FLAG_CLEAR_ACTION_RIGHT, FWP_ACTION_BLOCK, FWP_ACTION_TYPE,
    FWP_BYTE_BLOB, FWP_BYTE_BLOB_TYPE, FWP_CONDITION_FLAG_IS_LOOPBACK, FWP_CONDITION_VALUE0,
    FWP_MATCH_EQUAL, FWP_MATCH_FLAGS_NONE_SET, FWP_UINT32, FWP_UINT8, FWP_VALUE0, FWP_VALUE0_0,
};

const FWP_E_FILTER_NOT_FOUND: u32 = 0x8032_0003;
const FWP_E_NOT_FOUND: u32 = 0x8032_0001;
/// Returned by `FwpmFilterCreateEnumHandle0` when the enum template's provider
/// key has never had any filters (e.g. our provider was never created yet).
/// This is a normal "nothing to enumerate" state, not a real failure.
const FWP_E_NEVER_MATCH: u32 = 0x8032_0033;

use super::app_id::AppIdBlob;
use super::engine::EngineHandle;
use super::error::{FirewallError, Result};
use super::types::{
    FilterSpec, FirewallRule, FILTER_SPECS, PROVIDER_KEY, RULE_DESCRIPTION, RULE_NAMESPACE,
    SUBLAYER_KEY,
};

#[derive(Debug, Clone)]
struct FilterRecord {
    key: GUID,
    display_name: String,
    exe_path: PathBuf,
}

struct EnumHandle {
    engine: HANDLE,
    raw: HANDLE,
}

impl EnumHandle {
    fn new(engine: &EngineHandle, template: &FWPM_FILTER_ENUM_TEMPLATE0) -> Result<Self> {
        let mut handle = HANDLE::default();
        // SAFETY: engine handle and template pointers are valid; handle is an out-pointer.
        let status = unsafe {
            FwpmFilterCreateEnumHandle0(engine.raw(), Some(template as *const _), &mut handle)
        };
        if status != ERROR_SUCCESS.0 {
            return Err(FirewallError::from_win32(
                "FwpmFilterCreateEnumHandle0",
                status,
            ));
        }

        Ok(Self {
            engine: engine.raw(),
            raw: handle,
        })
    }
}

impl Drop for EnumHandle {
    fn drop(&mut self) {
        // SAFETY: raw enum handle belongs to engine and can be destroyed once.
        let _ = unsafe { FwpmFilterDestroyEnumHandle0(self.engine, self.raw) };
    }
}

/// Converts a Rust string into a null-terminated UTF-16 buffer for Win32 APIs.
fn to_wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Builds a stable WFP filter key for one executable, protocol, and IP layer.
///
/// The key is deterministic so the same executable always maps to the same
/// rule identifiers for block and unblock operations. That lets us:
/// - delete rules without enumerating everything first,
/// - check whether a rule exists,
/// - keep IPv4/IPv6 and TCP/UDP filters tied to the same app consistently.
pub fn deterministic_filter_key(exe: &str, spec: FilterSpec) -> GUID {
    let material = format!(
        "{}|{}|{}|{}",
        exe.to_ascii_lowercase(),
        spec.protocol,
        spec.ip_version,
        spec.layer_key.to_u128()
    );
    let uuid = Uuid::new_v5(&RULE_NAMESPACE, material.as_bytes());
    GUID::from_u128(uuid.as_u128())
}

/// Creates the four outbound block filters for a single executable.
///
/// This writes one filter per combination of:
/// - IPv4 / IPv6
/// - TCP / UDP
///
/// Each filter is scoped to the executable through `FWPM_CONDITION_ALE_APP_ID`.
pub fn add_block_filters(engine: &EngineHandle, exe_path: &str, app_id: &AppIdBlob) -> Result<()> {
    for spec in FILTER_SPECS {
        let filter_key = deterministic_filter_key(exe_path, spec);
        let display_name = format!(
            "Kaaval block {} {}: {}",
            spec.protocol_name, spec.ip_version, exe_path
        );
        let description = format!(
            "{} {} {}",
            RULE_DESCRIPTION, spec.protocol_name, spec.ip_version
        );

        let mut display_name_w = to_wide_null(&display_name);
        let mut description_w = to_wide_null(&description);

        let mut conditions = [
            FWPM_FILTER_CONDITION0 {
                fieldKey: FWPM_CONDITION_ALE_APP_ID,
                matchType: FWP_MATCH_EQUAL,
                conditionValue: FWP_CONDITION_VALUE0 {
                    r#type: FWP_BYTE_BLOB_TYPE,
                    Anonymous: windows::Win32::NetworkManagement::WindowsFilteringPlatform::FWP_CONDITION_VALUE0_0 {
                        byteBlob: app_id.as_ptr() as *mut FWP_BYTE_BLOB,
                    },
                },
            },
            FWPM_FILTER_CONDITION0 {
                fieldKey: FWPM_CONDITION_IP_PROTOCOL,
                matchType: FWP_MATCH_EQUAL,
                conditionValue: FWP_CONDITION_VALUE0 {
                    r#type: FWP_UINT8,
                    Anonymous: windows::Win32::NetworkManagement::WindowsFilteringPlatform::FWP_CONDITION_VALUE0_0 {
                        uint8: spec.protocol,
                    },
                },
            },
            FWPM_FILTER_CONDITION0 {
                fieldKey: FWPM_CONDITION_FLAGS,
                matchType: FWP_MATCH_FLAGS_NONE_SET,
                conditionValue: FWP_CONDITION_VALUE0 {
                    r#type: FWP_UINT32,
                    Anonymous: windows::Win32::NetworkManagement::WindowsFilteringPlatform::FWP_CONDITION_VALUE0_0 {
                        uint32: FWP_CONDITION_FLAG_IS_LOOPBACK,
                    },
                },
            },
        ];

        let filter = FWPM_FILTER0 {
            filterKey: filter_key,
            displayData: FWPM_DISPLAY_DATA0 {
                name: PWSTR(display_name_w.as_mut_ptr()),
                description: PWSTR(description_w.as_mut_ptr()),
            },
            // Clear right bits so lower-priority callouts/filters cannot override this block.
            flags: FWPM_FILTER_FLAGS(FWPM_FILTER_FLAG_CLEAR_ACTION_RIGHT.0),
            providerKey: &PROVIDER_KEY as *const GUID as *mut GUID,
            providerData: Default::default(),
            layerKey: spec.layer_key,
            subLayerKey: SUBLAYER_KEY,
            // Use a high explicit weight in this sublayer to prioritize block semantics.
            weight: FWP_VALUE0 {
                r#type: FWP_UINT8,
                Anonymous: FWP_VALUE0_0 { uint8: 0x0f },
            },
            numFilterConditions: conditions.len() as u32,
            filterCondition: conditions.as_mut_ptr(),
            action: FWPM_ACTION0 {
                r#type: FWP_ACTION_TYPE(FWP_ACTION_BLOCK.0),
                Anonymous: Default::default(),
            },
            ..Default::default()
        };

        debug!(
            protocol = spec.protocol_name,
            ip_version = spec.ip_version,
            "creating WFP block filter"
        );
        // SAFETY: filter and condition buffers remain alive for call duration; output id not needed.
        let status = unsafe { FwpmFilterAdd0(engine.raw(), &filter, None, None) };
        if status != ERROR_SUCCESS.0 {
            return Err(FirewallError::from_win32("FwpmFilterAdd0", status));
        }
    }

    Ok(())
}

/// Deletes the four deterministic filters associated with one executable.
pub fn delete_block_filters(engine: &EngineHandle, exe_path: &str) -> Result<()> {
    for spec in FILTER_SPECS {
        let filter_key = deterministic_filter_key(exe_path, spec);
        debug!(
            protocol = spec.protocol_name,
            ip_version = spec.ip_version,
            "deleting WFP block filter"
        );
        // SAFETY: engine handle is valid and key pointer references a valid GUID.
        let status = unsafe { FwpmFilterDeleteByKey0(engine.raw(), &filter_key) };
        if status == ERROR_SUCCESS.0 {
            continue;
        }

        // Ignore not-found; still continue deleting remaining protocol/layer filters.
        if status == FWP_E_NOT_FOUND || status == FWP_E_FILTER_NOT_FOUND {
            continue;
        }

        return Err(FirewallError::from_win32("FwpmFilterDeleteByKey0", status));
    }

    Ok(())
}

/// Returns true only if all expected block filters exist for the executable.
pub fn are_all_filters_present(engine: &EngineHandle, exe_path: &str) -> Result<bool> {
    for spec in FILTER_SPECS {
        let key = deterministic_filter_key(exe_path, spec);
        if !filter_exists_by_key(engine, &key)? {
            return Ok(false);
        }
    }

    Ok(true)
}

/// Returns all WFP filters that belong to this application's provider.
pub fn list_provider_rules(engine: &EngineHandle) -> Result<Vec<FirewallRule>> {
    let filters = enum_provider_filter_records(engine)?;
    let mut rules = Vec::with_capacity(filters.len());

    for filter in filters {
        let guid = Uuid::from_u128(filter.key.to_u128());
        let display_name = filter.display_name;
        let exe_path = filter.exe_path;
        rules.push(FirewallRule {
            guid,
            exe_path,
            display_name,
        });
    }

    Ok(rules)
}

/// Removes every filter owned by this application's provider.
pub fn delete_all_provider_filters(engine: &EngineHandle) -> Result<()> {
    let filters = enum_provider_filter_records(engine)?;
    for filter in filters {
        debug!(key = %Uuid::from_u128(filter.key.to_u128()), "deleting provider filter");
        // SAFETY: engine handle is valid and key pointer references a valid GUID.
        let status = unsafe { FwpmFilterDeleteByKey0(engine.raw(), &filter.key) };
        if status != ERROR_SUCCESS.0 {
            return Err(FirewallError::from_win32("FwpmFilterDeleteByKey0", status));
        }
    }

    Ok(())
}

fn enum_provider_filter_records(engine: &EngineHandle) -> Result<Vec<FilterRecord>> {
    let mut provider_key = PROVIDER_KEY;
    let template = FWPM_FILTER_ENUM_TEMPLATE0 {
        providerKey: &mut provider_key,
        ..Default::default()
    };
    let enum_handle = match EnumHandle::new(engine, &template) {
        Ok(handle) => handle,
        Err(FirewallError::WindowsApi { code, .. }) if code == FWP_E_NEVER_MATCH => {
            return Ok(Vec::new());
        }
        Err(err) => return Err(err),
    };

    let mut out_filters: *mut *mut FWPM_FILTER0 = null_mut();
    let mut count = 0u32;

    // SAFETY: engine and enum handle are valid, out pointers are valid for API writes.
    let status = unsafe {
        FwpmFilterEnum0(
            engine.raw(),
            enum_handle.raw,
            1024,
            &mut out_filters,
            &mut count,
        )
    };

    if status != ERROR_SUCCESS.0 {
        return Err(FirewallError::from_win32("FwpmFilterEnum0", status));
    }

    if count == 0 || out_filters.is_null() {
        return Ok(Vec::new());
    }

    // SAFETY: API returned count pointers to FWPM_FILTER0 structures.
    let slice: &[*mut FWPM_FILTER0] =
        unsafe { std::slice::from_raw_parts(out_filters, count as usize) };
    let mut collected = Vec::with_capacity(slice.len());
    for &ptr in slice {
        if ptr.is_null() {
            continue;
        }

        // SAFETY: each pointer is valid for the lifetime of API output memory.
        let filter = unsafe { ptr.as_ref() }.ok_or(FirewallError::AppIdDecode)?;
        let display_name = read_pwstr(filter.displayData.name);
        let exe_path = extract_exe_path_from_filter(filter)?;
        collected.push(FilterRecord {
            key: filter.filterKey,
            display_name,
            exe_path,
        });
    }

    let mut free_ptr = out_filters as *mut core::ffi::c_void;
    // SAFETY: memory returned by FwpmFilterEnum0 must be freed with FwpmFreeMemory0.
    unsafe { FwpmFreeMemory0(&mut free_ptr) };

    Ok(collected)
}

fn filter_exists_by_key(engine: &EngineHandle, key: &GUID) -> Result<bool> {
    let mut filter_ptr: *mut FWPM_FILTER0 = null_mut();
    // SAFETY: engine handle and key pointer are valid, output pointer is valid for writes.
    let status = unsafe { FwpmFilterGetByKey0(engine.raw(), key, &mut filter_ptr) };

    if status == ERROR_SUCCESS.0 {
        if !filter_ptr.is_null() {
            let mut free_ptr = filter_ptr as *mut core::ffi::c_void;
            // SAFETY: memory returned by FwpmFilterGetByKey0 must be released with FwpmFreeMemory0.
            unsafe { FwpmFreeMemory0(&mut free_ptr) };
        }
        return Ok(true);
    }

    if status == FWP_E_NOT_FOUND || status == FWP_E_FILTER_NOT_FOUND {
        return Ok(false);
    }

    Err(FirewallError::from_win32("FwpmFilterGetByKey0", status))
}

/// Reads a WFP-owned UTF-16 string into an owned Rust `String`.
///
/// WFP returns display names and descriptions as null-terminated UTF-16
/// pointers. This helper converts those pointers into safe owned text.
fn read_pwstr(value: PWSTR) -> String {
    if value.is_null() {
        return String::new();
    }

    let mut len = 0usize;
    // SAFETY: value points to a NUL-terminated UTF-16 string allocated by WFP.
    unsafe {
        while *value.0.add(len) != 0 {
            len += 1;
        }
        let slice = std::slice::from_raw_parts(value.0, len);
        String::from_utf16_lossy(slice)
    }
}

/// Extracts the executable path stored in the `FWPM_CONDITION_ALE_APP_ID`
/// condition for a provider-owned filter.
///
/// The app-id blob is UTF-16 encoded path data allocated by WFP. This helper
/// walks the filter conditions, finds the app-id condition, and decodes the
/// blob back into a `PathBuf` for display and management.
fn extract_exe_path_from_filter(filter: &FWPM_FILTER0) -> Result<PathBuf> {
    if filter.filterCondition.is_null() || filter.numFilterConditions == 0 {
        return Err(FirewallError::AppIdDecode);
    }

    let conditions = unsafe {
        std::slice::from_raw_parts(filter.filterCondition, filter.numFilterConditions as usize)
    };

    for condition in conditions {
        if condition.fieldKey != FWPM_CONDITION_ALE_APP_ID {
            continue;
        }

        if condition.conditionValue.r#type != FWP_BYTE_BLOB_TYPE {
            continue;
        }

        let blob_ptr = unsafe { condition.conditionValue.Anonymous.byteBlob };
        if blob_ptr.is_null() {
            continue;
        }

        let blob = unsafe { blob_ptr.as_ref() }.ok_or(FirewallError::AppIdDecode)?;
        if blob.data.is_null() || blob.size == 0 {
            continue;
        }

        let units_len = (blob.size as usize) / 2;
        // SAFETY: blob data contains at least size bytes; interpret as UTF-16 code units.
        let units = unsafe { std::slice::from_raw_parts(blob.data as *const u16, units_len) };
        let mut owned = units.to_vec();
        while owned.last() == Some(&0) {
            owned.pop();
        }
        let text = String::from_utf16(&owned).map_err(|_| FirewallError::AppIdDecode)?;
        return Ok(PathBuf::from(text));
    }

    Err(FirewallError::AppIdDecode)
}

/// Builds a filter key namespaced by `tag` so mode-owned filters never collide
/// with the manual per-app block filters keyed by `deterministic_filter_key`.
fn tagged_filter_key(tag: &str, exe: &str, spec: FilterSpec) -> GUID {
    let material = format!(
        "{tag}|{}|{}|{}|{}",
        exe.to_ascii_lowercase(),
        spec.protocol,
        spec.ip_version,
        spec.layer_key.to_u128()
    );
    let uuid = Uuid::new_v5(&RULE_NAMESPACE, material.as_bytes());
    GUID::from_u128(uuid.as_u128())
}

/// Same as `tagged_filter_key` but for filters with no app-id condition
/// (i.e. one filter per protocol/IP version, not per executable).
fn tagged_blanket_filter_key(tag: &str, spec: FilterSpec) -> GUID {
    let material = format!(
        "{tag}|*|{}|{}|{}",
        spec.protocol,
        spec.ip_version,
        spec.layer_key.to_u128()
    );
    let uuid = Uuid::new_v5(&RULE_NAMESPACE, material.as_bytes());
    GUID::from_u128(uuid.as_u128())
}

/// Creates per-executable filters (scoped by app id) for a mode, tagged so they
/// can be added/removed independently of manual blocks and other mode tags.
pub fn add_tagged_app_filters(
    engine: &EngineHandle,
    tag: &str,
    exe_path: &str,
    app_id: &AppIdBlob,
    action: FWP_ACTION_TYPE,
    weight: u8,
) -> Result<()> {
    for spec in FILTER_SPECS {
        let filter_key = tagged_filter_key(tag, exe_path, spec);
        let display_name = format!(
            "Kaaval {tag} {} {}: {}",
            spec.protocol_name, spec.ip_version, exe_path
        );
        let description = format!(
            "{RULE_DESCRIPTION} {} {} ({tag})",
            spec.protocol_name, spec.ip_version
        );

        let mut display_name_w = to_wide_null(&display_name);
        let mut description_w = to_wide_null(&description);

        let mut conditions = [
            FWPM_FILTER_CONDITION0 {
                fieldKey: FWPM_CONDITION_ALE_APP_ID,
                matchType: FWP_MATCH_EQUAL,
                conditionValue: FWP_CONDITION_VALUE0 {
                    r#type: FWP_BYTE_BLOB_TYPE,
                    Anonymous: windows::Win32::NetworkManagement::WindowsFilteringPlatform::FWP_CONDITION_VALUE0_0 {
                        byteBlob: app_id.as_ptr() as *mut FWP_BYTE_BLOB,
                    },
                },
            },
            FWPM_FILTER_CONDITION0 {
                fieldKey: FWPM_CONDITION_IP_PROTOCOL,
                matchType: FWP_MATCH_EQUAL,
                conditionValue: FWP_CONDITION_VALUE0 {
                    r#type: FWP_UINT8,
                    Anonymous: windows::Win32::NetworkManagement::WindowsFilteringPlatform::FWP_CONDITION_VALUE0_0 {
                        uint8: spec.protocol,
                    },
                },
            },
        ];

        let filter = FWPM_FILTER0 {
            filterKey: filter_key,
            displayData: FWPM_DISPLAY_DATA0 {
                name: PWSTR(display_name_w.as_mut_ptr()),
                description: PWSTR(description_w.as_mut_ptr()),
            },
            flags: FWPM_FILTER_FLAGS(FWPM_FILTER_FLAG_CLEAR_ACTION_RIGHT.0),
            providerKey: &PROVIDER_KEY as *const GUID as *mut GUID,
            providerData: Default::default(),
            layerKey: spec.layer_key,
            subLayerKey: SUBLAYER_KEY,
            weight: FWP_VALUE0 {
                r#type: FWP_UINT8,
                Anonymous: FWP_VALUE0_0 { uint8: weight },
            },
            numFilterConditions: conditions.len() as u32,
            filterCondition: conditions.as_mut_ptr(),
            action: FWPM_ACTION0 {
                r#type: action,
                Anonymous: Default::default(),
            },
            ..Default::default()
        };

        debug!(
            tag,
            exe = exe_path,
            protocol = spec.protocol_name,
            "creating tagged WFP filter"
        );
        // SAFETY: filter and condition buffers remain alive for call duration; output id not needed.
        let status = unsafe { FwpmFilterAdd0(engine.raw(), &filter, None, None) };
        if status != ERROR_SUCCESS.0 {
            return Err(FirewallError::from_win32("FwpmFilterAdd0", status));
        }
    }

    Ok(())
}

/// Deletes the tagged per-executable filters created by `add_tagged_app_filters`.
pub fn delete_tagged_app_filters(engine: &EngineHandle, tag: &str, exe_path: &str) -> Result<()> {
    for spec in FILTER_SPECS {
        let filter_key = tagged_filter_key(tag, exe_path, spec);
        // SAFETY: engine handle is valid and key pointer references a valid GUID.
        let status = unsafe { FwpmFilterDeleteByKey0(engine.raw(), &filter_key) };
        if status == ERROR_SUCCESS.0
            || status == FWP_E_NOT_FOUND
            || status == FWP_E_FILTER_NOT_FOUND
        {
            continue;
        }
        return Err(FirewallError::from_win32("FwpmFilterDeleteByKey0", status));
    }

    Ok(())
}

/// Creates filters with no app-id condition (i.e. matching every executable)
/// for the given protocol/IP version combinations. Used for default-deny.
pub fn add_tagged_blanket_filters(
    engine: &EngineHandle,
    tag: &str,
    action: FWP_ACTION_TYPE,
    weight: u8,
) -> Result<()> {
    for spec in FILTER_SPECS {
        let filter_key = tagged_blanket_filter_key(tag, spec);
        let display_name = format!("Kaaval {tag} {} {}", spec.protocol_name, spec.ip_version);
        let description = format!(
            "{RULE_DESCRIPTION} {} {} ({tag})",
            spec.protocol_name, spec.ip_version
        );

        let mut display_name_w = to_wide_null(&display_name);
        let mut description_w = to_wide_null(&description);

        let mut conditions = [FWPM_FILTER_CONDITION0 {
            fieldKey: FWPM_CONDITION_IP_PROTOCOL,
            matchType: FWP_MATCH_EQUAL,
            conditionValue: FWP_CONDITION_VALUE0 {
                r#type: FWP_UINT8,
                Anonymous: windows::Win32::NetworkManagement::WindowsFilteringPlatform::FWP_CONDITION_VALUE0_0 {
                    uint8: spec.protocol,
                },
            },
        }];

        let filter = FWPM_FILTER0 {
            filterKey: filter_key,
            displayData: FWPM_DISPLAY_DATA0 {
                name: PWSTR(display_name_w.as_mut_ptr()),
                description: PWSTR(description_w.as_mut_ptr()),
            },
            flags: FWPM_FILTER_FLAGS(FWPM_FILTER_FLAG_CLEAR_ACTION_RIGHT.0),
            providerKey: &PROVIDER_KEY as *const GUID as *mut GUID,
            providerData: Default::default(),
            layerKey: spec.layer_key,
            subLayerKey: SUBLAYER_KEY,
            weight: FWP_VALUE0 {
                r#type: FWP_UINT8,
                Anonymous: FWP_VALUE0_0 { uint8: weight },
            },
            numFilterConditions: conditions.len() as u32,
            filterCondition: conditions.as_mut_ptr(),
            action: FWPM_ACTION0 {
                r#type: action,
                Anonymous: Default::default(),
            },
            ..Default::default()
        };

        debug!(
            tag,
            protocol = spec.protocol_name,
            "creating tagged blanket WFP filter"
        );
        // SAFETY: filter and condition buffers remain alive for call duration; output id not needed.
        let status = unsafe { FwpmFilterAdd0(engine.raw(), &filter, None, None) };
        if status != ERROR_SUCCESS.0 {
            return Err(FirewallError::from_win32("FwpmFilterAdd0", status));
        }
    }

    Ok(())
}

/// Deletes the blanket filters created by `add_tagged_blanket_filters`.
pub fn delete_tagged_blanket_filters(engine: &EngineHandle, tag: &str) -> Result<()> {
    for spec in FILTER_SPECS {
        let filter_key = tagged_blanket_filter_key(tag, spec);
        // SAFETY: engine handle is valid and key pointer references a valid GUID.
        let status = unsafe { FwpmFilterDeleteByKey0(engine.raw(), &filter_key) };
        if status == ERROR_SUCCESS.0
            || status == FWP_E_NOT_FOUND
            || status == FWP_E_FILTER_NOT_FOUND
        {
            continue;
        }
        return Err(FirewallError::from_win32("FwpmFilterDeleteByKey0", status));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use crate::firewall::types::FILTER_SPECS;

    use super::deterministic_filter_key;

    #[test]
    fn deterministic_keys_are_stable() {
        let a = deterministic_filter_key("C:\\\\Apps\\\\app.exe", FILTER_SPECS[0]);
        let b = deterministic_filter_key("C:\\\\Apps\\\\app.exe", FILTER_SPECS[0]);
        assert_eq!(Uuid::from_u128(a.to_u128()), Uuid::from_u128(b.to_u128()));
    }

    #[test]
    fn protocol_changes_key() {
        let a = deterministic_filter_key("C:\\\\Apps\\\\app.exe", FILTER_SPECS[0]);
        let b = deterministic_filter_key("C:\\\\Apps\\\\app.exe", FILTER_SPECS[1]);
        assert_ne!(Uuid::from_u128(a.to_u128()), Uuid::from_u128(b.to_u128()));
    }
}
