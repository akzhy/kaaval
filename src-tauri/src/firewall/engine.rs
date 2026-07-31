use tracing::debug;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{ERROR_SUCCESS, HANDLE};
use windows::Win32::NetworkManagement::WindowsFilteringPlatform::{
    FwpmEngineClose0, FwpmEngineOpen0, FwpmTransactionAbort0, FwpmTransactionBegin0,
    FwpmTransactionCommit0,
};
use windows::Win32::System::Rpc::RPC_C_AUTHN_WINNT;

use super::error::{FirewallError, Result};

/// RAII wrapper around a WFP engine handle.
pub struct EngineHandle {
    raw: HANDLE,
}

// WFP engine handles are opaque OS handles. We serialize operations using
// higher-level synchronization in application state, and transferring ownership
// across threads does not violate handle invariants.
unsafe impl Send for EngineHandle {}
// Shared references do not permit mutation without external synchronization.
unsafe impl Sync for EngineHandle {}

impl EngineHandle {
    pub fn open() -> Result<Self> {
        let mut handle = HANDLE::default();

        debug!("opening WFP engine");
        let status = unsafe {
            FwpmEngineOpen0(
                PCWSTR::null(),
                RPC_C_AUTHN_WINNT,
                None,
                None,
                &mut handle,
            )
        };

        if status != ERROR_SUCCESS.0 {
            return Err(FirewallError::from_win32("FwpmEngineOpen0", status));
        }

        Ok(Self { raw: handle })
    }

    pub fn raw(&self) -> HANDLE {
        self.raw
    }

    pub fn transaction(&self) -> Result<Transaction<'_>> {
        Transaction::begin(self)
    }
}

impl Drop for EngineHandle {
    fn drop(&mut self) {
        debug!("closing WFP engine");
        // raw is either a valid engine handle returned by FwpmEngineOpen0
        // or default; FwpmEngineClose0 handles close semantics.
        let _ = unsafe { FwpmEngineClose0(self.raw) };
    }
}

/// Transaction guard that aborts automatically unless committed.
pub struct Transaction<'a> {
    engine: &'a EngineHandle,
    committed: bool,
}

impl<'a> Transaction<'a> {
    fn begin(engine: &'a EngineHandle) -> Result<Self> {
        let status = unsafe { FwpmTransactionBegin0(engine.raw(), 0) };
        if status != ERROR_SUCCESS.0 {
            return Err(FirewallError::from_win32("FwpmTransactionBegin0", status));
        }

        Ok(Self {
            engine,
            committed: false,
        })
    }

    pub fn commit(mut self) -> Result<()> {
        // SAFETY: engine handle is valid and we are within an open transaction.
        let status = unsafe { FwpmTransactionCommit0(self.engine.raw()) };
        if status != ERROR_SUCCESS.0 {
            return Err(FirewallError::from_win32("FwpmTransactionCommit0", status));
        }

        self.committed = true;
        Ok(())
    }
}

impl Drop for Transaction<'_> {
    fn drop(&mut self) {
        if self.committed {
            return;
        }

        // SAFETY: aborting a still-open transaction for this valid engine handle.
        let _ = unsafe { FwpmTransactionAbort0(self.engine.raw()) };
    }
}
