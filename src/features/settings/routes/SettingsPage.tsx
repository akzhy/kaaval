import { css } from "@flairjs/client";
import { useEffect, useState } from "react";
import Card from "@/components/Card";
import Modal from "@/components/Modal";
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
import {
  checkForUpdate,
  getAppVersionString,
  type PendingUpdate,
} from "@/utils/updater";
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
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(
    null,
  );
  const [updateStatus, setUpdateStatus] = useState("");
  const [appVersion, setAppVersion] = useState("-");
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

  useEffect(() => {
    let mounted = true;
    getAppVersionString()
      .then((version) => {
        if (mounted) {
          setAppVersion(version);
        }
      })
      .catch((e) => {
        if (mounted) {
          setAppVersion("unknown");
          console.error("failed to get app version", e);
        }
      });

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

  async function onCheckForUpdates() {
    setCheckingUpdates(true);
    setUpdateStatus("");

    const result = await checkForUpdate();

    if (result.status === "up-to-date") {
      setUpdateStatus("You are on the latest version.");
    } else if (result.status === "available") {
      setPendingUpdate(result.update);
    } else {
      setUpdateStatus(`Update check failed: ${result.message}`);
    }

    setCheckingUpdates(false);
  }

  async function onInstallUpdate() {
    if (!pendingUpdate) {
      return;
    }

    setInstallingUpdate(true);
    setUpdateStatus("");

    try {
      await pendingUpdate.install();
      setUpdateStatus(
        `Update ${pendingUpdate.version} installed. Restart Kaaval if it does not close automatically.`,
      );
      setPendingUpdate(null);
    } catch (e) {
      setUpdateStatus(
        `Update install failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setInstallingUpdate(false);
    }
  }

  function onCloseUpdateModal() {
    if (!pendingUpdate || installingUpdate) {
      return;
    }
    setUpdateStatus(`Update ${pendingUpdate.version} is available.`);
    setPendingUpdate(null);
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
            <span className="settings-row-hint">{appVersion}</span>
          </div>
          <div className="settings-row">
            <div className="settings-row-copy">
              <span>Updates</span>
              <span className="settings-row-hint">
                Checks GitHub Releases for new versions.
              </span>
            </div>
            <button
              type="button"
              className="settings-button"
              onClick={() => onCheckForUpdates()}
              disabled={checkingUpdates}
            >
              {checkingUpdates ? "Checking..." : "Check for updates"}
            </button>
          </div>
          {updateStatus ? <p className="settings-row-hint">{updateStatus}</p> : null}
        </div>
      </Card>

      {pendingUpdate ? (
        <Modal title="Update available" onClose={onCloseUpdateModal}>
          <div className="settings-update-modal">
            <p className="settings-update-title">
              Kaaval {pendingUpdate.version} is available.
            </p>
            <p className="settings-update-hint">
              Current version: {pendingUpdate.currentVersion}
            </p>

            {pendingUpdate.notes ? (
              <>
                <p className="settings-update-label">Release notes</p>
                <pre className="settings-update-notes">{pendingUpdate.notes}</pre>
              </>
            ) : (
              <p className="settings-update-hint">
                No release notes were provided for this update.
              </p>
            )}

            <div className="settings-update-actions">
              <button
                type="button"
                className="settings-button"
                onClick={onCloseUpdateModal}
                disabled={installingUpdate}
              >
                Later
              </button>
              <button
                type="button"
                className="settings-button settings-button-primary"
                onClick={() => onInstallUpdate()}
                disabled={installingUpdate}
              >
                {installingUpdate ? "Installing..." : "Install update"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
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

  .settings-button {
    border: 1px solid $colors.border;
    background-color: $colors.surface;
    color: $colors.text;
    border-radius: $radii.pill;
    padding: 7px 12px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
  }

  .settings-button:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .settings-button-primary {
    background-color: $colors.primary;
    border-color: $colors.primary;
    color: white;
  }

  .settings-update-modal {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .settings-update-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: $colors.text;
  }

  .settings-update-hint {
    margin: 0;
    color: $colors.text-muted;
    font-size: 0.8rem;
    line-height: 1.45;
  }

  .settings-update-label {
    margin: 4px 0 0;
    color: $colors.text;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .settings-update-notes {
    margin: 0;
    white-space: pre-wrap;
    max-height: 250px;
    overflow: auto;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    background-color: $colors.surface;
    padding: 10px;
    color: $colors.text;
    font-family: inherit;
    font-size: 0.8rem;
    line-height: 1.45;
  }

  .settings-update-actions {
    margin-top: 4px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
`;

export default SettingsPage;
