import { css } from "@flairjs/client";
import { useEffect, useState } from "react";
import Card from "@/components/Card";
import Switch from "@/components/Switch";
import {
  getAppSettings,
  setBlockInternetOnly,
  setThemePreference,
  setTurnOffModesAndFiltersOnClose,
} from "@/utils/api";
import {
  applyThemePreference,
  getStoredThemePreference,
  setStoredThemePreference,
} from "@/utils/theme";
import type { ThemePreference } from "@/utils/types";

function SettingsPage() {
  const [turnOffOnClose, setTurnOffOnClose] = useState(false);
  const [blockInternetOnly, setBlockInternetOnlyState] = useState(true);
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    getStoredThemePreference(),
  );
  const [loading, setLoading] = useState(true);
  const [savingClose, setSavingClose] = useState(false);
  const [savingInternetOnly, setSavingInternetOnly] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const settings = await getAppSettings();
        if (!mounted) {
          return;
        }
        setTurnOffOnClose(settings.turn_off_modes_and_filters_on_close);
        setBlockInternetOnlyState(settings.block_internet_only);
        setThemePreferenceState(settings.theme_preference);
        setStoredThemePreference(settings.theme_preference);
        applyThemePreference(settings.theme_preference);
        setError("");
      } catch (e) {
        if (!mounted) {
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function onToggleTurnOffOnClose(next: boolean) {
    setSavingClose(true);
    setError("");
    try {
      const settings = await setTurnOffModesAndFiltersOnClose(next);
      setTurnOffOnClose(settings.turn_off_modes_and_filters_on_close);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingClose(false);
    }
  }

  async function onThemePreferenceChange(next: ThemePreference) {
    setSavingTheme(true);
    setError("");
    try {
      const settings = await setThemePreference(next);
      setThemePreferenceState(settings.theme_preference);
      setStoredThemePreference(settings.theme_preference);
      applyThemePreference(settings.theme_preference);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingTheme(false);
    }
  }

  async function onToggleBlockInternetOnly(next: boolean) {
    setSavingInternetOnly(true);
    setError("");
    try {
      const settings = await setBlockInternetOnly(next);
      setBlockInternetOnlyState(settings.block_internet_only);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingInternetOnly(false);
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-page-head">
        <p className="settings-page-title">Settings</p>
        <p className="settings-page-subtitle">
          General preferences for Kaaval.
        </p>
      </div>

      <Card>
        <div className="settings-section">
          <p className="settings-section-title">Appearance</p>
          <div className="settings-row">
            <div className="settings-row-copy">
              <label htmlFor="theme-preference">Theme</label>
              <span className="settings-row-hint">
                Choose how Kaaval should color its interface.
              </span>
            </div>
            <select
              id="theme-preference"
              className="settings-select"
              value={themePreference}
              onChange={(event) => {
                onThemePreferenceChange(event.target.value as ThemePreference);
              }}
              disabled={loading || savingTheme}
              aria-label="Theme"
            >
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <div className="settings-section">
          <p className="settings-section-title">General</p>
          <div className="settings-row">
            <div className="settings-row-copy">
              <span>Only block internet-bound traffic</span>
              <span className="settings-row-hint">
                Loopback and LAN traffic stay allowed even when apps are blocked
                by filters or modes.
              </span>
            </div>
            <Switch
              checked={blockInternetOnly}
              onCheckedChange={onToggleBlockInternetOnly}
              disabled={loading || savingInternetOnly}
              ariaLabel="Only block internet-bound traffic"
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-copy">
              <span>Turn off modes and filters when app is closed</span>
              <span className="settings-row-hint">
                Disables active mode and removes all Kaaval firewall blocks on
                close.
              </span>
            </div>
            <Switch
              checked={turnOffOnClose}
              onCheckedChange={onToggleTurnOffOnClose}
              disabled={loading || savingClose}
              ariaLabel="Turn off modes and filters when app is closed"
            />
          </div>
          {error ? <p className="settings-error">{error}</p> : null}
        </div>
      </Card>

      <Card>
        <div className="settings-section">
          <p className="settings-section-title">About</p>
          <div className="settings-row">
            <span>Version</span>
            <span className="settings-row-hint">0.1.0</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

SettingsPage.flair = css`
  .settings-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .settings-page-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: $colors.text;
  }

  .settings-page-subtitle {
    margin: 4px 0 0;
    font-size: 0.82rem;
    color: $colors.text-muted;
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .settings-section-title {
    margin: 0 0 4px;
    font-size: 0.9rem;
    font-weight: 600;
    color: $colors.text;
  }

  .settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-size: 0.85rem;
    color: $colors.text;
    padding: 8px 0;
    border-top: 1px solid $colors.border;
  }

  .settings-row-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: $colors.text;
  }

  .settings-row-hint {
    color: $colors.text-muted;
    font-size: 0.78rem;
  }

  .settings-select {
    min-width: 140px;
    padding: 8px 12px;
    border-radius: $radii.card;
    border: 1px solid $colors.border;
    background-color: $colors.surface;
    color: $colors.text;
    font: inherit;
  }

  .settings-select:focus {
    outline: 1px solid $colors.primary;
    outline-offset: 1px;
  }

  .settings-error {
    margin: 6px 0 0;
    font-size: 0.78rem;
    color: #c0392b;
  }
`;

export default SettingsPage;
