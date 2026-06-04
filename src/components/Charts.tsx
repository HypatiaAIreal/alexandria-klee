"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { domainColor } from "@/lib/labels";
import { useI18n } from "@/components/LanguageProvider";

const AXIS = "#a99d88";
const tooltipStyle = {
  background: "#1b1611",
  border: "1px solid #2c241b",
  borderRadius: 8,
  color: "#efe6d4",
  fontSize: 12,
  fontFamily: "var(--font-mono, monospace)",
};
// Recharts colours the item/label lines with the series colour by default,
// which is unreadable on the dark tooltip — force them light.
const tooltipItemStyle = { color: "#efe6d4" };
const tooltipLabelStyle = { color: "#a99d88" };

export function ConceptBarChart({
  data,
}: {
  data: { term: string; count: number; color: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="term"
          width={96}
          stroke={AXIS}
          tick={{ fill: "#e2d4ba", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          cursor={{ fill: "rgba(216,166,87,0.08)" }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
          {data.map((d) => (
            <Cell key={d.term} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DomainDonut({ data }: { data: { domain: string; count: number }[] }) {
  const { t } = useI18n();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="domain"
          innerRadius={58}
          outerRadius={92}
          paddingAngle={2}
          stroke="#100d0a"
          strokeWidth={2}
        >
          {data.map((d) => (
            <Cell key={d.domain} fill={domainColor(d.domain)} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value: number, name: string) => [`${value}`, t(`domains.${name}`)]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DomainLegend({ data }: { data: { domain: string; count: number }[] }) {
  const { t } = useI18n();
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {data.map((d) => (
        <li key={d.domain} className="flex items-center gap-2 text-parchment-300">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: domainColor(d.domain) }} />
          <span className="flex-1 truncate">{t(`domains.${d.domain}`)}</span>
          <span className="font-mono text-parchment-400">{d.count}</span>
        </li>
      ))}
    </ul>
  );
}
