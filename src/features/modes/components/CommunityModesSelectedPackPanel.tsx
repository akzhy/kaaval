import Modal from "@/components/Modal";
import { css } from "@flairjs/client";
import type { Mode } from "@/utils/types";
import { modeTypeLabel } from "../utils/modesTransfer";
import type { CatalogEntry, RemotePack } from "../utils/communityModes";

type CommunityModesSelectedPackPanelProps = {
  selectedEntry: CatalogEntry | null;
  selectedPack: RemotePack | null;
  packLoading: boolean;
  packError: string;
  importing: boolean;
  onImport: () => void;
  onClose: () => void;
};

function CommunityModesSelectedPackPanel({
  selectedEntry,
  selectedPack,
  packLoading,
  packError,
  importing,
  onImport,
  onClose,
}: CommunityModesSelectedPackPanelProps) {
  if (!selectedEntry) {
    return null;
  }

  return (
    <Modal title={selectedEntry.title} onClose={onClose}>
      <div className="community-modes-detail-panel">
        {packLoading ? (
          <div className="community-modes-detail-empty">Loading pack...</div>
        ) : packError ? (
          <div className="community-modes-detail-empty community-modes-detail-error">
            {packError}
          </div>
        ) : selectedPack ? (
          <div className="community-modes-detail">
            {selectedPack.entry.description ? (
              <p className="community-modes-pack-description">
                {selectedPack.entry.description}
              </p>
            ) : null}

            <div className="community-modes-pack-meta">
              <span className="community-modes-pack-pill">
                {selectedPack.modes.length} mode
                {selectedPack.modes.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="community-modes-mode-list">
              {selectedPack.modes.map((mode) => (
                <div
                  key={mode.id ?? `${mode.name}-${mode.mode_type}`}
                  className="community-modes-mode-card"
                >
                  <div className="community-modes-mode-card-head">
                    <div>
                      <p className="community-modes-mode-name">{mode.name}</p>
                      <p className="community-modes-mode-type">
                        {modeTypeLabel(mode as Mode)}
                      </p>
                    </div>
                  </div>

                  {mode.description ? (
                    <p className="community-modes-mode-description">
                      {mode.description}
                    </p>
                  ) : null}

                  <div className="community-modes-mode-matchers">
                    {mode.matchers.map((matcher) => (
                      <span
                        key={`${matcher.kind}:${matcher.value}`}
                        className="community-modes-mode-chip"
                      >
                        {matcher.value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="community-modes-detail-footer">
              <button
                type="button"
                className="community-modes-import-btn"
                onClick={onImport}
                disabled={importing || selectedPack.modes.length === 0}
              >
                {importing ? "Importing..." : "Import pack"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

CommunityModesSelectedPackPanel.flair = css`
  .community-modes-detail-panel {
    min-width: min(720px, 100%);
  }

  .community-modes-detail-empty {
    display: flex;
    align-items: center;
    gap: 10px;
    color: $colors.text-muted;
    margin: 0;
    font-size: 0.86rem;
  }

  .community-modes-detail {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .community-modes-detail-footer {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .community-modes-mode-name {
    margin: 0;
    font-weight: 600;
  }

  .community-modes-detail-subtitle,
  .community-modes-mode-type {
    margin: 0;
    font-size: 0.76rem;
    color: $colors.text-muted;
  }

  .community-modes-import-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: $radii.card;
    padding: 8px 12px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    background-color: $colors.primary;
    border: 1px solid $colors.primary;
    color: white;
  }

  .community-modes-import-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .community-modes-pack-description,
  .community-modes-mode-description {
    margin: 0;
    font-size: 0.82rem;
    color: $colors.text;
    line-height: 1.4;
  }

  .community-modes-pack-meta,
  .community-modes-mode-matchers {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .community-modes-pack-pill,
  .community-modes-mode-chip {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 3px 8px;
    background-color: $colors.surface;
    color: $colors.text;
    font-size: 0.72rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-modes-mode-list {
    display: grid;
    gap: 12px;
  }

  .community-modes-mode-card {
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 12px;
    background-color: $colors.surface;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .community-modes-mode-card-head {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
`;

export default CommunityModesSelectedPackPanel;