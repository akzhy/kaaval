import type { PropsWithChildren } from "react";
import { css } from "@flairjs/client";
import { X } from "lucide-react";

type ModalProps = PropsWithChildren<{
  title: string;
  onClose: () => void;
}>;

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <p className="modal-title">{title}</p>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

Modal.flair = css`
  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 24px;
  }

  .modal-panel {
    background-color: $colors.surface-bright;
    border: 1px solid $colors.border;
    border-radius: $radii.card;
    width: min(640px, 100%);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid $colors.border;
  }

  .modal-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: $colors.text;
  }

  .modal-close {
    background: none;
    border: none;
    color: $colors.text-muted;
    font-size: 1.3rem;
    line-height: 1;
    cursor: pointer;
    padding: 2px 6px;
  }

  .modal-close:hover {
    color: $colors.text;
  }

  .modal-body {
    padding: 18px;
    overflow-y: auto;
  }
`;

export default Modal;
