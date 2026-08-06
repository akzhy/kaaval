import Modal from "@/components/Modal";
import { css } from "@flairjs/client";
import type { ImportDecision } from "../utils/modesTransfer";

type CommunityModesConflictModalProps = {
  conflict: {
    modeName: string;
    existingName: string;
  } | null;
  onResolve: (decision: ImportDecision) => void;
};

function CommunityModesConflictModal({
  conflict,
  onResolve,
}: CommunityModesConflictModalProps) {
  if (!conflict) {
    return null;
  }

  return (
    <Modal title="Import conflict" onClose={() => onResolve("cancel")}>
      <div className="community-modes-conflict">
        <p className="community-modes-conflict-title">
          {conflict.modeName} already exists as {conflict.existingName}.
        </p>
        <p className="community-modes-conflict-hint">
          Choose how to handle this imported mode.
        </p>
        <div className="community-modes-conflict-actions">
          <button
            type="button"
            className="community-modes-conflict-btn community-modes-conflict-btn-primary"
            onClick={() => onResolve("replace")}
          >
            Replace existing
          </button>
          <button
            type="button"
            className="community-modes-conflict-btn"
            onClick={() => onResolve("copy")}
          >
            Import as copy
          </button>
          <button
            type="button"
            className="community-modes-conflict-btn"
            onClick={() => onResolve("skip")}
          >
            Skip this mode
          </button>
          <button
            type="button"
            className="community-modes-conflict-btn community-modes-conflict-btn-secondary"
            onClick={() => onResolve("cancel")}
          >
            Cancel import
          </button>
        </div>
      </div>
    </Modal>
  );
}

CommunityModesConflictModal.flair = css`
  .community-modes-conflict {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .community-modes-conflict-title {
    margin: 0;
    font-weight: 600;
    color: $colors.text;
  }

  .community-modes-conflict-hint {
    margin: 0;
    font-size: 0.82rem;
    color: $colors.text;
    line-height: 1.4;
  }

  .community-modes-conflict-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .community-modes-conflict-btn {
    border: 1px solid $colors.border;
    background-color: $colors.surface;
    border-radius: $radii.card;
    padding: 8px 12px;
    color: $colors.text;
    font-size: 0.82rem;
    cursor: pointer;
  }

  .community-modes-conflict-btn-primary {
    background-color: $colors.primary;
    border-color: $colors.primary;
    color: white;
  }

  .community-modes-conflict-btn-secondary {
    background-color: $colors.surface-bright;
  }
`;

export default CommunityModesConflictModal;