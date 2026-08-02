import { useEffect, useState } from "react";
import { css } from "@flairjs/client";
import Card from "@/components/Card";
import Modal from "@/components/Modal";
import { useModesStore } from "@/store/modesStore";
import type { Mode } from "@/utils/types";
import ModeForm from "../components/ModeForm";

function modeTypeLabel(mode: Mode): string {
  return mode.mode_type === "block_all_except"
    ? "Block all except"
    : "Block these";
}

function ModesPage() {
  const modes = useModesStore((state) => state.modes);
  const error = useModesStore((state) => state.error);
  const refresh = useModesStore((state) => state.refresh);
  const deleteModeAction = useModesStore((state) => state.deleteMode);
  const setActive = useModesStore((state) => state.setActive);

  const [editingMode, setEditingMode] = useState<Mode | null | undefined>(
    undefined,
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openCreate() {
    refresh();
    setEditingMode(null);
  }

  return (
    <div className="modes-page">
      <div className="modes-page-head">
        <div>
          <p className="modes-page-title">Modes</p>
          <p className="modes-page-subtitle">
            Group applications into switchable allow/block profiles.
          </p>
        </div>
        <button
          type="button"
          className="modes-page-create"
          onClick={openCreate}
        >
          + Create New Mode
        </button>
      </div>

      {error ? <div className="modes-page-error">{error}</div> : null}

      <div className="modes-page-grid">
        {modes.map((mode) => (
          <Card key={mode.id}>
            <div className="mode-card">
              <div className="mode-card-head">
                <div className="mode-card-heading">
                  {mode.icon_data_url ? (
                    <img
                      src={mode.icon_data_url}
                      alt=""
                      className="mode-card-icon"
                    />
                  ) : (
                    <span className="mode-card-icon mode-card-icon-fallback">
                      {mode.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <p className="mode-card-name">{mode.name}</p>
                </div>
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

              <p className="mode-card-label">{modeTypeLabel(mode)}</p>
              <div className="mode-card-chips">
                {mode.matchers.slice(0, 6).map((matcher) => (
                  <span
                    key={`${matcher.kind}:${matcher.value}`}
                    className="mode-chip"
                  >
                    {matcher.value}
                  </span>
                ))}
                {mode.matchers.length > 6 ? (
                  <span className="mode-chip">
                    +{mode.matchers.length - 6} more
                  </span>
                ) : null}
              </div>

              <div className="mode-card-actions">
                <button
                  type="button"
                  className={
                    mode.active
                      ? "mode-action-btn mode-action-btn-danger"
                      : "mode-action-btn mode-action-btn-primary"
                  }
                  onClick={() => void setActive(mode.id, !mode.active)}
                >
                  {mode.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  className="mode-action-btn"
                  onClick={() => setEditingMode(mode)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="mode-action-btn"
                  onClick={() => void deleteModeAction(mode.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </Card>
        ))}

        <Card dashed>
          <button type="button" className="mode-create" onClick={openCreate}>
            <span className="mode-create-icon">+</span>
            <p className="mode-create-title">Create New Mode</p>
            <p className="mode-create-hint">
              Define custom rules for apps and protocols
            </p>
          </button>
        </Card>
      </div>

      {editingMode !== undefined ? (
        <Modal
          title={editingMode ? "Edit Mode" : "Create New Mode"}
          onClose={() => setEditingMode(undefined)}
        >
          <ModeForm
            initialMode={editingMode}
            onClose={() => setEditingMode(undefined)}
          />
        </Modal>
      ) : null}
    </div>
  );
}

ModesPage.flair = css`
  .modes-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modes-page-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
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

  .modes-page-create {
    background-color: $colors.primary;
    border: none;
    border-radius: $radii.card;
    padding: 8px 14px;
    color: white;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .modes-page-error {
    border: 1px solid $colors.negative;
    background-color: color-mix(in srgb, $colors.negative 12%, transparent);
    color: $colors.negative;
    border-radius: $radii.card;
    padding: 10px 14px;
    font-size: 0.85rem;
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
    gap: 8px;
  }

  .mode-card-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .mode-card-icon {
    width: 26px;
    height: 26px;
    border-radius: $radii.card;
    object-fit: cover;
    flex-shrink: 0;
  }

  .mode-card-icon-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    color: $colors.text-muted;
    font-weight: 700;
    font-size: 0.8rem;
  }

  .mode-card-name {
    margin: 0;
    font-weight: 600;
    color: $colors.text;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-status {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: $colors.text-muted;
    white-space: nowrap;
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
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-card-actions {
    margin-top: auto;
    display: flex;
    gap: 8px;
  }

  .mode-action-btn {
    flex: 1;
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 6px 8px;
    color: $colors.text;
    font-size: 0.76rem;
    cursor: pointer;
  }

  .mode-action-btn-primary {
    background-color: $colors.primary;
    border-color: $colors.primary;
    color: white;
    font-weight: 600;
  }

  .mode-action-btn-danger {
    background-color: transparent;
    border-color: $colors.negative;
    color: $colors.negative;
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
    width: 100%;
    color: $colors.text-muted;
    background: none;
    border: none;
    cursor: pointer;
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
