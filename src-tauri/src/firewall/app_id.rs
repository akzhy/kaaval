use std::path::Path;

use windows::core::PCWSTR;
use windows::Win32::Foundation::ERROR_SUCCESS;
use windows::Win32::NetworkManagement::WindowsFilteringPlatform::{
    FwpmFreeMemory0, FwpmGetAppIdFromFileName0, FWP_BYTE_BLOB,
};

use super::error::{FirewallError, Result};

/// Owned wrapper around an app-id blob allocated by WFP APIs.
pub struct AppIdBlob {
    raw: *mut FWP_BYTE_BLOB,
}

impl AppIdBlob {
    pub fn from_executable_path(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Err(FirewallError::ExecutableNotFound(path.to_path_buf()));
        }

        let path_str = path
            .to_str()
            .ok_or_else(|| FirewallError::InvalidUtf16Path(path.to_path_buf()))?;
        let wide: Vec<u16> = path_str.encode_utf16().chain(std::iter::once(0)).collect();

        let mut blob_ptr = std::ptr::null_mut();

        // SAFETY: The path buffer is null-terminated UTF-16 and valid for the duration
        // of the call, and blob_ptr is a valid out-pointer for the API allocation.
        let status = unsafe { FwpmGetAppIdFromFileName0(PCWSTR(wide.as_ptr()), &mut blob_ptr) };

        if status != ERROR_SUCCESS.0 {
            return Err(FirewallError::from_win32(
                "FwpmGetAppIdFromFileName0",
                status,
            ));
        }

        if blob_ptr.is_null() {
            return Err(FirewallError::AppIdDecode);
        }

        Ok(Self { raw: blob_ptr })
    }

    pub fn as_ptr(&self) -> *const FWP_BYTE_BLOB {
        self.raw as *const FWP_BYTE_BLOB
    }

}

impl Drop for AppIdBlob {
    fn drop(&mut self) {
        if self.raw.is_null() {
            return;
        }

        let mut ptr = self.raw as *mut core::ffi::c_void;
        // SAFETY: Memory was allocated by WFP APIs and must be released with FwpmFreeMemory0.
        unsafe { FwpmFreeMemory0(&mut ptr) };
        self.raw = std::ptr::null_mut();
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn utf16_path_roundtrip() {
        let sample = "C:\\\\Program Files\\\\Example\\\\app.exe";
        let units: Vec<u16> = sample.encode_utf16().chain(std::iter::once(0)).collect();
        let decoded = String::from_utf16(&units[..units.len() - 1]).unwrap();
        assert_eq!(sample, decoded);
    }
}
