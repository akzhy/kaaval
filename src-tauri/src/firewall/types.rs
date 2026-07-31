use std::path::PathBuf;

use serde::Serialize;
use uuid::Uuid;
use windows::core::GUID;
use windows::Win32::Networking::WinSock::{IPPROTO_TCP, IPPROTO_UDP};
use windows::Win32::NetworkManagement::WindowsFilteringPlatform::{
    FWPM_LAYER_ALE_AUTH_CONNECT_V4, FWPM_LAYER_ALE_AUTH_CONNECT_V6,
};

pub const PROVIDER_KEY: GUID =
    GUID::from_u128(0x49d02b4191bfc67b0fb103e6a9cd9645);
pub const SUBLAYER_KEY: GUID =
    GUID::from_u128(0xd0ef888808b538a56fd4fb3a2c37618a);
pub const RULE_NAMESPACE: Uuid =
    Uuid::from_u128(0x96c7cb12f1889e8b1a4ae8b76b46e1fd);

pub const PROVIDER_NAME: &str = "Kaval Firewall";
pub const PROVIDER_DESCRIPTION: &str = "Rules managed by Kaval Firewall.";
pub const RULE_DESCRIPTION: &str = "Managed by Kaval Firewall backend.";

#[derive(Debug, Clone, Copy)]
pub struct FilterSpec {
    pub protocol: u8,
    pub protocol_name: &'static str,
    pub ip_version: &'static str,
    pub layer_key: GUID,
}

pub const FILTER_SPECS: [FilterSpec; 4] = [
    FilterSpec {
        protocol: IPPROTO_TCP.0 as u8,
        protocol_name: "TCP",
        ip_version: "IPv4",
        layer_key: FWPM_LAYER_ALE_AUTH_CONNECT_V4,
    },
    FilterSpec {
        protocol: IPPROTO_UDP.0 as u8,
        protocol_name: "UDP",
        ip_version: "IPv4",
        layer_key: FWPM_LAYER_ALE_AUTH_CONNECT_V4,
    },
    FilterSpec {
        protocol: IPPROTO_TCP.0 as u8,
        protocol_name: "TCP",
        ip_version: "IPv6",
        layer_key: FWPM_LAYER_ALE_AUTH_CONNECT_V6,
    },
    FilterSpec {
        protocol: IPPROTO_UDP.0 as u8,
        protocol_name: "UDP",
        ip_version: "IPv6",
        layer_key: FWPM_LAYER_ALE_AUTH_CONNECT_V6,
    },
];

#[derive(Debug, Clone)]
pub struct FirewallRule {
    pub guid: Uuid,
    pub exe_path: PathBuf,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FirewallRuleDto {
    pub guid: String,
    pub exe_path: String,
    pub display_name: String,
}

impl From<FirewallRule> for FirewallRuleDto {
    fn from(value: FirewallRule) -> Self {
        Self {
            guid: value.guid.to_string(),
            exe_path: value.exe_path.to_string_lossy().to_string(),
            display_name: value.display_name,
        }
    }
}
