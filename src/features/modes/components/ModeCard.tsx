import { useState } from "react";
import { css } from "@flairjs/client";
import { Pencil, Trash2 } from "lucide-react";
import Card from "@/components/Card";
import Modal from "@/components/Modal";
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  function openDeleteConfirm() {
    if (!onDelete) {
      return;
    }
    setConfirmDeleteOpen(true);
  }

  function closeDeleteConfirm() {
    setConfirmDeleteOpen(false);
  }

  function confirmDelete() {
    onDelete?.();
    closeDeleteConfirm();
  }

  return (
    <>
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
          {mode.description ? (
            <p className="mode-card-description">{mode.description}</p>
          ) : null}
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

          <div className="mode-card-footer">
            <div className="mode-card-footer-actions">
              <button
                type="button"
                className="mode-footer-btn"
                onClick={() => onEdit?.()}
                disabled={!onEdit}
                aria-label="Edit"
              >
                <Pencil size={14} />
              </button>
              {onDelete && (
                <button
                  type="button"
                  className="mode-footer-btn mode-footer-btn-danger"
                  onClick={openDeleteConfirm}
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {confirmDeleteOpen ? (
        <Modal title="Delete mode" onClose={closeDeleteConfirm}>
          <div className="mode-delete-confirm">
            <p className="mode-delete-confirm-text">
              Delete mode "{mode.name}"? This action cannot be undone.
            </p>
            <div className="mode-delete-confirm-actions">
              <button
                type="button"
                className="mode-action-btn"
                onClick={closeDeleteConfirm}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mode-action-btn mode-action-btn-danger"
                onClick={confirmDelete}
                disabled={!onDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
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

  .mode-card-description {
    margin: 0;
    font-size: 0.78rem;
    color: $colors.text;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
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

  .mode-card-footer {
    margin-top: auto;
    margin-left: -16px;
    margin-right: -16px;
    margin-bottom: -16px;
    border-top: 1px solid $colors.border;
    padding: 8px 12px;
    display: flex;
    justify-content: flex-end;
  }

  .mode-card-footer-actions {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .mode-footer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background-color: transparent;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    color: $colors.text-muted;
    cursor: pointer;
    padding: 0;
  }

  .mode-footer-btn:hover {
    background-color: $colors.surface;
    color: $colors.text;
  }

  .mode-footer-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .mode-footer-btn-danger {
    border-color: $colors.negative;
    color: $colors.negative;
  }

  .mode-footer-btn-danger:hover {
    background-color: $colors.negative;
    color: #fff;
  }

  .mode-action-btn {
    background-color: $colors.surface;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    padding: 10px 12px;
    color: $colors.text;
    font-size: 0.76rem;
    cursor: pointer;
  }

  .mode-action-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .mode-action-btn-danger {
    background-color: transparent;
    border-color: $colors.negative;
    color: $colors.negative;
    font-weight: 600;

    &:hover {
      background-color: $colors.negative;
      color: #fff;
    }
  }

  .mode-delete-confirm {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .mode-delete-confirm-text {
    margin: 0;
    color: $colors.text;
    font-size: 0.86rem;
  }

  .mode-delete-confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
`;

export default ModeCard;
