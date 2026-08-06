import { Download, FileJson2, Sparkles } from "lucide-react";
import { css } from "@flairjs/client";
import Card from "@/components/Card";
import type { CatalogEntry } from "../utils/communityModes";

type CommunityModesCatalogPanelProps = {
  catalogLoading: boolean;
  filteredCatalog: CatalogEntry[];
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
};

function CommunityModesCatalogPanel({
  catalogLoading,
  filteredCatalog,
  selectedPath,
  onSelectPath,
}: CommunityModesCatalogPanelProps) {
  return (
    <section className="community-modes-list-panel">
      {catalogLoading ? (
        <Card>
          <div className="community-modes-loading">
            <Sparkles size={16} />
            Loading community packs...
          </div>
        </Card>
      ) : filteredCatalog.length === 0 ? (
        <Card>
          <div className="community-modes-empty">
            <FileJson2 size={18} />
            <div>
              <p className="community-modes-empty-title">No packs matched.</p>
              <p className="community-modes-empty-hint">
                Try a different search term or refresh the catalog.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        filteredCatalog.map((entry) => {
          const active = entry.path === selectedPath;
          return (
            <button
              key={entry.path}
              type="button"
              className={
                active
                  ? "community-mode-tile community-mode-tile-active"
                  : "community-mode-tile"
              }
              onClick={() => onSelectPath(entry.path)}
            >
              <div className="community-mode-tile-head">
                <div>
                  <p className="community-mode-tile-name">{entry.title}</p>
                </div>
                <Download size={14} />
              </div>

              {entry.description ? (
                <p className="community-mode-tile-description">
                  {entry.description}
                </p>
              ) : null}
            </button>
          );
        })
      )}
    </section>
  );
}

CommunityModesCatalogPanel.flair = css`
  .community-modes-list-panel {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: calc(100vh - 220px);
    overflow-y: auto;
    padding-right: 4px;
  }

  .community-modes-loading,
  .community-modes-empty {
    display: flex;
    align-items: center;
    gap: 10px;
    color: $colors.text-muted;
  }

  .community-modes-empty-title {
    margin: 0;
    font-size: 0.86rem;
  }

  .community-modes-empty-hint {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: $colors.text-muted;
  }

  .community-mode-tile {
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: left;
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 14px;
    color: $colors.text;
    cursor: pointer;
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease,
      transform 0.2s ease;
  }

  .community-mode-tile:hover {
    border-color: color-mix(in srgb, $colors.primary 35%, $colors.border);
    background-color: $colors.surface-bright;
  }

  .community-mode-tile-active {
    border-color: $colors.primary;
    background-color: color-mix(in srgb, $colors.primary 10%, $colors.surface);
  }

  .community-mode-tile-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .community-mode-tile-name {
    margin: 0;
    font-weight: 600;
  }

  .community-mode-tile-path {
    margin: 4px 0 0;
    font-size: 0.76rem;
    color: $colors.text-muted;
  }

  .community-mode-tile-description {
    margin: 0;
    font-size: 0.82rem;
    color: $colors.text;
    line-height: 1.4;
  }

  @media (max-width: 1080px) {
    .community-modes-list-panel {
      max-height: none;
    }
  }
`;

export default CommunityModesCatalogPanel;
