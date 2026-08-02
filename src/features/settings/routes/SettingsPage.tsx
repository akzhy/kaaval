import { css } from "@flairjs/client";
import Card from "@/components/Card";

function SettingsPage() {
  return (
    <div className="settings-page">
      <div className="settings-page-head">
        <p className="settings-page-title">Settings</p>
        <p className="settings-page-subtitle">
          General preferences for Kaaval. More options coming soon.
        </p>
      </div>

      <Card>
        <div className="settings-section">
          <p className="settings-section-title">General</p>
          <div className="settings-row">
            <span>Launch Kaaval at startup</span>
            <span className="settings-row-hint">Coming soon</span>
          </div>
          <div className="settings-row">
            <span>Show notifications for blocked connections</span>
            <span className="settings-row-hint">Coming soon</span>
          </div>
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
    font-size: 0.85rem;
    color: $colors.text;
    padding: 8px 0;
    border-top: 1px solid $colors.border;
  }

  .settings-row-hint {
    color: $colors.text-muted;
    font-size: 0.78rem;
  }
`;

export default SettingsPage;
