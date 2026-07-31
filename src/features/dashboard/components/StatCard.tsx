import { css } from "@flairjs/client";

type StatCardProps = {
  label: string;
  value: string | number;
  hint: string;
  tone?: "default" | "positive" | "negative";
};

function StatCard({ label, value, hint, tone = "default" }: StatCardProps) {
  const valueClass =
    tone === "positive" ? "stat-value stat-value-positive" : tone === "negative" ? "stat-value stat-value-negative" : "stat-value";

  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className={valueClass}>{value}</p>
      <p className="stat-hint">{hint}</p>
    </div>
  );
}

StatCard.flair = css`
  .stat {
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
  }

  .stat-label {
    margin: 0;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: $colors.text-muted;
  }

  .stat-value {
    margin: 0;
    font-size: 1.9rem;
    font-weight: 700;
    color: $colors.text;
  }

  .stat-value-positive {
    color: $colors.positive;
  }

  .stat-value-negative {
    color: $colors.negative;
  }

  .stat-hint {
    margin: 0;
    font-size: 0.78rem;
    color: $colors.text-muted;
  }
`;

export default StatCard;
