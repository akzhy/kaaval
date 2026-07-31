import { css } from "@flairjs/client";
import { formatMbps } from "@/utils/format";

type ThroughputChartProps = {
  history: number[];
  current: number;
};

function ThroughputChart({ history, current }: ThroughputChartProps) {
  const max = Math.max(1, ...history);

  return (
    <div className="throughput">
      <div className="throughput-head">
        <div>
          <p className="throughput-title">Network Throughput</p>
          <p className="throughput-subtitle">Real-time outbound/inbound data packets</p>
        </div>
        <p className="throughput-value">{formatMbps(current)}</p>
      </div>
      <div className="throughput-bars">
        {history.length === 0 ? (
          <p className="throughput-empty">Collecting samples…</p>
        ) : (
          history.map((value, index) => (
            <div key={index} className="throughput-bar" style={{ height: `${Math.max(6, (value / max) * 100)}%` }} />
          ))
        )}
      </div>
    </div>
  );
}

ThroughputChart.flair = css`
  .throughput {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
  }

  .throughput-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .throughput-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: $colors.text;
  }

  .throughput-subtitle {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: $colors.text-muted;
  }

  .throughput-value {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
    color: $colors.primary;
  }

  .throughput-bars {
    flex: 1;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    min-height: 120px;
  }

  .throughput-bar {
    flex: 1;
    background-color: $colors.primary;
    border-radius: $radii.card;
    opacity: 0.85;
    min-height: 6px;
  }

  .throughput-empty {
    color: $colors.text-muted;
    font-size: 0.8rem;
    margin: auto;
  }
`;

export default ThroughputChart;
