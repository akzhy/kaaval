import { css } from "@flairjs/client";
import { useEffect, useState } from "react";
import Card from "@/components/Card";
import Switch from "@/components/Switch";
import { getAppSettings, setTurnOffModesAndFiltersOnClose } from "@/utils/api";

function SettingsPage() {
  const [turnOffOnClose, setTurnOffOnClose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    setError("");
    try {
      const settings = await setTurnOffModesAndFiltersOnClose(next);
      setTurnOffOnClose(settings.turn_off_modes_and_filters_on_close);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
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
          <p className="settings-section-title">General</p>
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
              disabled={loading || saving}
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
  }

  .settings-row-hint {
    color: $colors.text-muted;
    font-size: 0.78rem;
  }

  .settings-error {
    margin: 6px 0 0;
    font-size: 0.78rem;
    color: #c0392b;
  }
`;

export default SettingsPage;
