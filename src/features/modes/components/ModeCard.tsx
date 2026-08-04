import { css } from "@flairjs/client";
import Card from "@/components/Card";
import Switch from "@/components/Switch";
import type { Mode } from "@/utils/types";
import { modeTypeLabel } from "../utils/modesTransfer";

type ModeCardProps = {
  mode: Mode;
  onToggleActive: (checked: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  matcherLimit?: number;
  showIcon?: boolean;
};

function ModeCard({
  mode,
  onToggleActive,
  onEdit,
  onDelete,
  matcherLimit = 6,
  showIcon = true,
}: ModeCardProps) {
  return (
    <Card>
      <div className="mode-card">
        <div className="mode-card-head">
          <div className="mode-card-heading">
            {showIcon ? (
              mode.icon_data_url ? (
                <img
                  src={mode.icon_data_url}
                  alt=""
                  className="mode-card-icon"
                />
              ) : (
                <span className="mode-card-icon mode-card-icon-fallback">
                  {mode.name.charAt(0).toUpperCase()}
                </span>
              )
            ) : null}
            <p className="mode-card-name">{mode.name}</p>
          </div>
          <Switch
            checked={mode.active}
            onCheckedChange={onToggleActive}
            ariaLabel={`Toggle ${mode.name}`}
          />
        </div>

        <p className="mode-card-label">{modeTypeLabel(mode)}</p>
        <div className="mode-card-chips">
          {mode.matchers.slice(0, matcherLimit).map((matcher) => (
            <span
              key={`${matcher.kind}:${matcher.value}`}
              className="mode-chip"
            >
              {matcher.value}
            </span>
          ))}
          {mode.matchers.length > matcherLimit ? (
            <span className="mode-chip">
              +{mode.matchers.length - matcherLimit} more
            </span>
          ) : null}
        </div>

        <div className="mode-card-actions">
          <button
            type="button"
            className="mode-action-btn"
            onClick={() => onEdit?.()}
            disabled={!onEdit}
          >
            Edit
          </button>
          <button
            type="button"
            className="mode-action-btn"
            onClick={() => onDelete?.()}
            disabled={!onDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </Card>
  );
}

ModeCard.flair = css`
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
    flex-wrap: wrap;
    align-items: center;
  }

  .mode-action-btn {
    flex: 1 1 110px;
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 6px 8px;
    color: $colors.text;
    font-size: 0.76rem;
    cursor: pointer;
  }

  .mode-action-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

export default ModeCard;
