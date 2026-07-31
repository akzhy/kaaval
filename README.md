# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Windows WFP Firewall Backend

This project now includes a Windows-only backend that manages outbound block rules through the Windows Filtering Platform (WFP) APIs directly from Rust.

### What it does

- Blocks a specific executable from outbound internet access.
- Unblocks a specific executable.
- Checks whether an executable is currently blocked.
- Lists all WFP filters created by this application.
- Removes all WFP filters created by this application.

The backend owns a provider named `Kaval Firewall` and uses only its own provider/sublayer scope, so it does not modify unrelated Windows Firewall rules.

### Why these WFP layers are used

Filters are created at:

- `FWPM_LAYER_ALE_AUTH_CONNECT_V4`
- `FWPM_LAYER_ALE_AUTH_CONNECT_V6`

These ALE connect authorization layers are the correct outbound decision points for app-level blocking. Each executable gets filters for both TCP and UDP on IPv4 and IPv6.

### Build and run (Windows)

From the repository root:

```powershell
pnpm install
pnpm tauri dev
```

To validate backend compilation only:

```powershell
cd src-tauri
cargo check
```

### Frontend usage example

```ts
import { invoke } from "@tauri-apps/api/core";

type FirewallRule = {
	guid: string;
	exe_path: string;
	display_name: string;
};

export async function block(path: string) {
	return invoke<{ success: boolean }>("block_application", { path });
}

export async function unblock(path: string) {
	return invoke<{ success: boolean }>("unblock_application", { path });
}

export async function isBlocked(path: string) {
	return invoke<boolean>("is_application_blocked", { path });
}

export async function listRules() {
	return invoke<FirewallRule[]>("list_firewall_rules");
}

export async function removeAllRules() {
	return invoke<{ success: boolean }>("remove_all_firewall_rules");
}
```
