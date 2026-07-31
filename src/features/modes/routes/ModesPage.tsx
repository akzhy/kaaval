import { css } from "@flairjs/client";
import Card from "@/components/Card";

const PLACEHOLDER_MODES = [
  {
    name: "Valorant Mode",
    active: true,
    priority: "High",
    allowed: ["valorant.exe", "riot.exe", "vanguard.sys", "discord.exe"],
  },
  {
    name: "Work Mode",
    active: false,
    priority: "Medium",
    allowed: ["teams.exe", "outlook.exe", "vscode.exe"],
  },
];

function ModesPage() {
  return (
    <div className="modes-page">
      <div className="modes-page-head">
        <p className="modes-page-title">Modes</p>
        <p className="modes-page-subtitle">
          Group allowed applications into switchable profiles. Coming soon.
        </p>
      </div>

      <div className="modes-page-grid">
        {PLACEHOLDER_MODES.map((mode) => (
          <Card key={mode.name}>
            <div className="mode-card">
              <div className="mode-card-head">
                <p className="mode-card-name">{mode.name}</p>
                <span
                  className={
                    mode.active
                      ? "mode-status mode-status-active"
                      : "mode-status"
                  }
                >
                  {mode.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mode-card-label">Allowed Processes:</p>
              <div className="mode-card-chips">
                {mode.allowed.map((item) => (
                  <span key={item} className="mode-chip">
                    {item}
                  </span>
                ))}
              </div>
              <p className="mode-card-priority">
                Priority Level: {mode.priority}
              </p>
            </div>
          </Card>
        ))}

        <Card dashed>
          <div className="mode-create">
            <span className="mode-create-icon">+</span>
            <p className="mode-create-title">Create New Mode</p>
            <p className="mode-create-hint">
              Define custom rules for apps and protocols
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

ModesPage.flair = css`
  .modes-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modes-page-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: $colors.text;
  }

  .modes-page-subtitle {
    margin: 4px 0 0;
    font-size: 0.82rem;
    color: $colors.text-muted;
  }

  .modes-page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
  }

  .mode-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
  }

  .mode-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .mode-card-name {
    margin: 0;
    font-weight: 600;
    color: $colors.text;
  }

  .mode-status {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: $colors.text-muted;
  }

  .mode-status-active {
    color: $colors.primary;
    font-weight: 700;
  }

  .mode-card-label {
    margin: 0;
    font-size: 0.75rem;
    color: $colors.text-muted;
  }

  .mode-card-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .mode-chip {
    font-size: 0.72rem;
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 3px 8px;
    color: $colors.text;
  }

  .mode-card-priority {
    margin-top: auto;
    font-size: 0.75rem;
    color: $colors.text-muted;
  }

  .mode-create {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 6px;
    height: 100%;
    min-height: 140px;
    color: $colors.text-muted;
  }

  .mode-create-icon {
    font-size: 1.4rem;
    color: $colors.primary;
  }

  .mode-create-title {
    margin: 0;
    font-weight: 600;
    color: $colors.text;
  }

  .mode-create-hint {
    margin: 0;
    font-size: 0.75rem;
  }
`;

export default ModesPage;
