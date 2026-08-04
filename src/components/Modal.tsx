import type { PropsWithChildren } from "react";
import { css } from "@flairjs/client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

type ModalProps = PropsWithChildren<{
  title: string;
  onClose: () => void;
}>;

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-panel">
          <div className="modal-content">
            <div className="modal-head">
              <Dialog.Title className="modal-title">{title}</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="modal-close"
                  aria-label="Close"
                >
                  <X />
                </button>
              </Dialog.Close>
            </div>
            <div className="modal-body">{children}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-content {
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
