"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DIMENSIONS } from "@/lib/constants";

/**
 * One line per rubric dimension over time (§9). Deliberately plain: the point
 * is the shape of the trend, not the chrome around it.
 */
const COLORS: Record<string, string> = {
  STRUCTURE: "#7aa2f7",
  QUANTITATIVE: "#d9a441",
  JUDGMENT: "#6fbf8b",
  SYNTHESIS: "#b48ead",
  PRESENCE: "#88c0d0",
};

export function ScoreTrend({ data }: { data: Record<string, string | number>[] }) {
  return (
    <div className="mt-2 h-64 rounded border border-rule bg-panel p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid stroke="rgb(var(--rule))" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "rgb(var(--faint))", fontSize: 11 }}
            stroke="rgb(var(--rule))"
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fill: "rgb(var(--faint))", fontSize: 11 }}
            stroke="rgb(var(--rule))"
          />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--panel))",
              border: "1px solid rgb(var(--rule))",
              borderRadius: 4,
              fontSize: 12,
            }}
            labelStyle={{ color: "rgb(var(--muted))" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "rgb(var(--muted))" }} />
          {DIMENSIONS.map((d) => (
            <Line
              key={d.value}
              type="monotone"
              dataKey={d.value}
              name={d.label}
              stroke={COLORS[d.value]}
              strokeWidth={1.5}
              dot={{ r: 2 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
