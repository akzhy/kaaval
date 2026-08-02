import { css } from "@flairjs/client";
import { formatMbps } from "@/utils/format";
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";

type ThroughputChartProps = {
  history: number[];
  current: number;
};

function ThroughputChart({ history, current }: ThroughputChartProps) {
  const chartData = history.map((value, index) => ({
    sample: index,
    value,
  }));

  return (
    <div className="throughput">
      <div className="throughput-head">
        <div>
          <p className="throughput-title">Network Throughput</p>
          <p className="throughput-subtitle">
            Real-time outbound/inbound data packets
          </p>
        </div>
        <p className="throughput-value">{formatMbps(current)}</p>
      </div>
      <div className="throughput-chart">
        {history.length === 0 ? (
          <p className="throughput-empty">Collecting samples…</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
            >
              <YAxis hide domain={[0, "dataMax + 1"]} />
              <Tooltip
                cursor={{ stroke: "rgba(120, 138, 165, 0.28)", strokeWidth: 1 }}
                formatter={(value) => {
                  const numericValue =
                    typeof value === "number" ? value : Number(value ?? 0);
                  return formatMbps(
                    Number.isFinite(numericValue) ? numericValue : 0,
                  );
                }}
                labelFormatter={() => "Throughput"}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid rgba(120, 138, 165, 0.25)",
                  background: "rgba(15, 23, 42, 0.92)",
                  color: "#e2e8f0",
                  fontSize: "0.75rem",
                }}
                itemStyle={{ color: "#e2e8f0" }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--kaaval-colors-primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
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

  .throughput-chart {
    flex: 1;
    width: 100%;
    min-height: 120px;
    border-radius: $radii.card;
    overflow: hidden;
  }

  .throughput-empty {
    color: $colors.text-muted;
    font-size: 0.8rem;
    margin: auto;
  }
`;

export default ThroughputChart;
