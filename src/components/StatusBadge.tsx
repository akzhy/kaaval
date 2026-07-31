import { c, css } from "@flairjs/client";

type StatusBadgeProps = {
  positive: boolean;
  positiveLabel: string;
  negativeLabel: string;
};

function StatusBadge({
  positive,
  positiveLabel,
  negativeLabel,
}: StatusBadgeProps) {
  const className = positive
    ? c("badge badge-positive")
    : c("badge badge-negative");
  return (
    <span className={className}>
      {positive ? positiveLabel : negativeLabel}
    </span>
  );
}

StatusBadge.flair = css`
  .badge {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .badge-positive {
    color: $colors.positive;
    background-color: color-mix(in srgb, $colors.positive 16%, transparent);
  }

  .badge-negative {
    color: $colors.negative;
    background-color: color-mix(in srgb, $colors.negative 16%, transparent);
  }
`;

export default StatusBadge;
