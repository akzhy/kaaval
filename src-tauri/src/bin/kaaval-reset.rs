//! Standalone CLI that removes every WFP firewall rule created by Kaaval
//! (manual per-app blocks, mode block/permit rules, and default-deny rules).
//!
//! Useful as an emergency reset if the app can't be launched, or to fully
//! clean up rules before uninstalling. Run as Administrator.

use std::io::{self, Write};

use kaaval_lib::firewall::FirewallManager;

fn main() {
    println!("Kaaval Firewall - Reset Tool");
    println!("Removes all firewall rules created by Kaaval.\n");

    let args: Vec<String> = std::env::args().skip(1).collect();
    let assume_yes = args.iter().any(|a| a == "-y" || a == "--yes");
    let list_only = args.iter().any(|a| a == "--list");

    let manager = match FirewallManager::new() {
        Ok(manager) => manager,
        Err(err) => {
            eprintln!("Failed to connect to the Windows Filtering Platform: {err}");
            eprintln!("This tool only works on Windows, ideally run as Administrator.");
            std::process::exit(1);
        }
    };

    let rules = match manager.list_rules() {
        Ok(rules) => rules,
        Err(err) => {
            eprintln!("Failed to list Kaaval firewall rules: {err}");
            eprintln!("If this says access denied, try running this tool as Administrator.");
            std::process::exit(1);
        }
    };

    if rules.is_empty() {
        println!("No Kaaval firewall rules are currently installed. Nothing to do.");
        return;
    }

    println!("Found {} rule(s):", rules.len());
    for rule in &rules {
        println!("  - {} ({})", rule.display_name, rule.exe_path.display());
    }

    if list_only {
        return;
    }

    if !assume_yes {
        print!("\nRemove all {} rule(s)? [y/N] ", rules.len());
        let _ = io::stdout().flush();
        let mut input = String::new();
        if io::stdin().read_line(&mut input).is_err() {
            eprintln!("Failed to read input; aborting.");
            std::process::exit(1);
        }
        if !matches!(input.trim().to_ascii_lowercase().as_str(), "y" | "yes") {
            println!("Aborted. No changes were made.");
            return;
        }
    }

    let _ = manager.set_default_deny(false);
    match manager.remove_all_rules() {
        Ok(()) => println!("\nAll Kaaval firewall rules were removed successfully."),
        Err(err) => {
            eprintln!("\nFailed to remove rules: {err}");
            eprintln!("If this says access denied, try running this tool as Administrator.");
            std::process::exit(1);
        }
    }
}
