use tracing::debug;
use windows::core::GUID;
use windows::Win32::Foundation::ERROR_SUCCESS;
use windows::Win32::NetworkManagement::WindowsFilteringPlatform::{
    FwpmProviderAdd0, FwpmSubLayerAdd0, FWPM_DISPLAY_DATA0, FWPM_SUBLAYER0,
};

use super::engine::EngineHandle;
use super::error::{FirewallError, Result};
use super::types::{PROVIDER_DESCRIPTION, PROVIDER_KEY, PROVIDER_NAME, SUBLAYER_KEY};

const FWP_E_ALREADY_EXISTS_CODE: u32 = 0x80320009;

fn to_wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

fn is_already_exists(status: u32) -> bool {
    status == FWP_E_ALREADY_EXISTS_CODE
}

pub fn ensure_provider_and_sublayer(engine: &EngineHandle) -> Result<()> {
    ensure_provider(engine)?;
    ensure_sublayer(engine)?;
    Ok(())
}

fn ensure_provider(engine: &EngineHandle) -> Result<()> {
    let mut name = to_wide_null(PROVIDER_NAME);
    let mut description = to_wide_null(PROVIDER_DESCRIPTION);

    let provider = windows::Win32::NetworkManagement::WindowsFilteringPlatform::FWPM_PROVIDER0 {
        providerKey: PROVIDER_KEY,
        displayData: FWPM_DISPLAY_DATA0 {
            name: windows::core::PWSTR(name.as_mut_ptr()),
            description: windows::core::PWSTR(description.as_mut_ptr()),
        },
        flags: 0,
        providerData: Default::default(),
        serviceName: windows::core::PWSTR::null(),
    };

    debug!("ensuring WFP provider exists");
    // SAFETY: engine handle is valid, provider points to initialized storage,
    // and security descriptor is null to use default ACL.
    let status = unsafe { FwpmProviderAdd0(engine.raw(), &provider, None) };
    if status == ERROR_SUCCESS.0 || is_already_exists(status) {
        return Ok(());
    }

    Err(FirewallError::from_win32("FwpmProviderAdd0", status))
}

fn ensure_sublayer(engine: &EngineHandle) -> Result<()> {
    let mut name = to_wide_null(PROVIDER_NAME);
    let mut description = to_wide_null(PROVIDER_DESCRIPTION);

    let mut provider_key: GUID = PROVIDER_KEY;
    let sublayer = FWPM_SUBLAYER0 {
        subLayerKey: SUBLAYER_KEY,
        displayData: FWPM_DISPLAY_DATA0 {
            name: windows::core::PWSTR(name.as_mut_ptr()),
            description: windows::core::PWSTR(description.as_mut_ptr()),
        },
        flags: 0,
        providerKey: &mut provider_key,
        providerData: Default::default(),
        weight: 0x100,
    };

    debug!("ensuring WFP sublayer exists");
    // SAFETY: engine handle is valid, sublayer points to initialized storage,
    // and security descriptor is null to use default ACL.
    let status = unsafe { FwpmSubLayerAdd0(engine.raw(), &sublayer, None) };
    if status == ERROR_SUCCESS.0 || is_already_exists(status) {
        return Ok(());
    }

    Err(FirewallError::from_win32("FwpmSubLayerAdd0", status))
}
