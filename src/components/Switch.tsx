import { css } from "@flairjs/client";
import * as RadixSwitch from "@radix-ui/react-switch";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
};

function Switch({
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
}: SwitchProps) {
  return (
    <RadixSwitch.Root
      className="app-switch"
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <RadixSwitch.Thumb className="app-switch-thumb" />
    </RadixSwitch.Root>
  );
}

Switch.flair = css`
  .app-switch {
    width: 40px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    flex-shrink: 0;
    padding: 3px;
    border: none;
    border-radius: 999px;
    background: $colors.border;
    transition: background-color 0.16s ease;
    cursor: pointer;
  }

  .app-switch[data-state="checked"] {
    background: $colors.primary;
  }

  .app-switch[data-disabled] {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .app-switch-thumb {
    display: block;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: #fff;
    transition: transform 0.16s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  }

  .app-switch[data-state="checked"] .app-switch-thumb {
    transform: translateX(16px);
  }

  .app-switch:focus-visible {
    outline: 1px solid $colors.primary;
    outline-offset: 2px;
  }
`;

export default Switch;
