import { useEffect } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { css } from "@flairjs/client";
import { Pencil } from "lucide-react";
import Card from "@/components/Card";
import { useModesStore } from "@/store/modesStore";

function ModesPreview() {
  const modes = useModesStore((state) => state.modes);
  const refresh = useModesStore((state) => state.refresh);
  const setActive = useModesStore((state) => state.setActive);
  const router = useRouter();

  useEffect(() => {
    refresh();
  }, [refresh]);

  const preview = modes.slice(0, 2);

  return (
    <section className="modes-preview">
      <div className="modes-preview-head">
        <div>
          <p className="modes-preview-title">Active Modes</p>
        </div>
        <Link to="/modes" className="modes-preview-link">
          View All Modes ›
        </Link>
      </div>

      <div className="modes-preview-grid">
        {preview.length === 0 ? (
          <p className="modes-preview-empty">
            No modes yet. Create one from the Modes page.
          </p>
        ) : (
          preview.map((mode) => (
            <Card key={mode.id}>
              <div className="mode-card">
                <div className="mode-card-head">
                  <div className="mode-card-heading">
                    <p className="mode-card-name">{mode.name}</p>
                  </div>
                  <div className="mode-card-head-actions">
                    <button
                      type="button"
                      className="mode-preview-edit-btn"
                      onClick={() => {
                        router.navigate({
                          to: "/modes",
                          search: { modeId: mode.id },
                        });
                      }}
                      aria-label={`Edit ${mode.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <span
                      className={
                        mode.active
                          ? "mode-status mode-status-active"
                          : "mode-status"
                      }
                    >
                      <span
                        className={
                          mode.active
                            ? "mode-active-dot"
                            : "mode-active-dot mode-active-dot-inactive"
                        }
                        aria-label={
                          mode.active ? "Active mode" : "Inactive mode"
                        }
                      />
                      {mode.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <p className="mode-card-label">
                  {mode.mode_type === "block_all_except"
                    ? "Block all except:"
                    : "Blocked applications:"}
                </p>
                <div className="mode-card-chips">
                  {mode.matchers.slice(0, 4).map((matcher) => (
                    <span
                      key={`${matcher.kind}:${matcher.value}`}
                      className="mode-chip"
                    >
                      {matcher.value}
                    </span>
                  ))}
                  {mode.matchers.length > 4 ? (
                    <span className="mode-chip mode-chip-ellipsis">…</span>
                  ) : null}
                </div>
                <div className="mode-card-footer">
                  <button
                    type="button"
                    className="modes-preview-toggle"
                    onClick={() => setActive(mode.id, !mode.active)}
                  >
                    {mode.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}

        <Card dashed>
          <Link to="/modes" className="mode-create">
            <span className="mode-create-icon">+</span>
            <p className="mode-create-title">Create New Mode</p>
            <p className="mode-create-hint">
              Define custom rules for apps and protocols
            </p>
          </Link>
        </Card>
      </div>
    </section>
  );
}

ModesPreview.flair = css`
  .modes-preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .modes-preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modes-preview-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: $colors.text;
  }

  .modes-preview-link {
    color: $colors.primary;
    font-size: 0.82rem;
    text-decoration: none;
  }

  .modes-preview-empty {
    margin: 0;
    font-size: 0.82rem;
    color: $colors.text-muted;
  }

  .modes-preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
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
    gap: 8px;
  }

  .mode-card-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .mode-card-name {
    margin: 0;
    font-weight: 600;
    color: $colors.text;
  }

  .mode-card-head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mode-active-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background-color: #2ecc71;
    box-shadow: 0 0 0 2px color-mix(in srgb, #2ecc71 20%, transparent);
    flex-shrink: 0;
  }

  .mode-active-dot-inactive {
    background-color: $colors.text-muted;
    box-shadow: none;
  }

  .mode-preview-edit-btn {
    border: none;
    background: transparent;
    color: $colors.primary;
    cursor: pointer;
    padding: 0;
    font-size: 0.8rem;
  }

  .mode-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
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

  .mode-chip-ellipsis {
    font-weight: 700;
  }

  .mode-card-footer {
    margin-top: auto;
    font-size: 0.75rem;
    color: $colors.text-muted;
  }

  .modes-preview-toggle {
    background: none;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 4px 10px;
    color: $colors.primary;
    font-size: 0.74rem;
    font-weight: 600;
    cursor: pointer;
  }

  .mode-create {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 6px;
    height: 100%;
    min-height: 120px;
    color: $colors.text-muted;
    text-decoration: none;
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

export default ModesPreview;
