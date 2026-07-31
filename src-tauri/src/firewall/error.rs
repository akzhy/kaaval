use std::path::PathBuf;

use thiserror::Error;

/// Result alias for firewall operations.
pub type Result<T> = std::result::Result<T, FirewallError>;

/// Error type for Windows Filtering Platform operations.
#[derive(Debug, Error)]
pub enum FirewallError {
    #[cfg(not(windows))]
    #[error("unsupported platform: this backend is only available on Windows")]
    UnsupportedPlatform,

    #[error("invalid executable path: {0}")]
    InvalidPath(String),

    #[error("executable not found: {0}")]
    ExecutableNotFound(PathBuf),

    #[error("path contains invalid UTF-16 data: {0}")]
    InvalidUtf16Path(PathBuf),

    #[error("windows API call '{api}' failed with status 0x{code:08X}")]
    WindowsApi { api: &'static str, code: u32 },

    #[error("access denied while calling '{api}'. Run the application with administrator privileges.")]
    AccessDenied { api: &'static str },

    #[error("failed to decode application id blob")]
    AppIdDecode,
}

impl FirewallError {
    pub fn from_win32(api: &'static str, code: u32) -> Self {
        if code == 5 {
            return Self::AccessDenied { api };
        }

        Self::WindowsApi {
            api,
            code,
        }
    }
}
