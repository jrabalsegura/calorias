"use client";

import { useState } from "react";
import { addDays, daysBetween, weekdayIndex } from "@/domain/day";
import { formatKg } from "@/domain/target";
import {
  pointsInRange,
  WEIGHT_RANGES,
  type TrendPoint,
  type WeightRange
} from "@/domain/weight";

// Plain SVG: a few hundred points need no chart library.
const WIDTH = 340;
const HEIGHT = 200;
const PAD = { top: 10, right: 8, bottom: 22, left: 34 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

/** The trend line is broken across gaps longer than this. */
const MAX_LINE_GAP_DAYS = 21;

const monthLabel = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", month: "short" });
const monthYearLabel = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC",
  month: "short",
  year: "2-digit"
});
const dayMonthLabel = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC",
  day: "numeric",
  month: "short"
});

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const clean = (label: string) => label.replace(/\./g, "");

function xTicks(from: string, span: number): { day: string; label: string }[] {
  const ticks: { day: string; label: string }[] = [];
  for (let offset = 0; offset <= span; offset += 1) {
    const day = addDays(from, offset);
    if (span <= 45) {
      if (weekdayIndex(day) === 0) {
        ticks.push({ day, label: clean(dayMonthLabel.format(asDate(day))) });
      }
    } else if (day.endsWith("-01")) {
      const month = Number(day.slice(5, 7));
      if (span > 400 && (month - 1) % 3 !== 0) continue;
      const format = span > 300 ? monthYearLabel : monthLabel;
      ticks.push({ day, label: clean(format.format(asDate(day))) });
    }
  }
  const every = Math.ceil(ticks.length / 5);
  return ticks.filter((_, index) => index % every === 0);
}

function yTicks(min: number, max: number): number[] {
  const step = [0.2, 0.5, 1, 2, 5, 10, 20].find((s) => (max - min) / s <= 5) ?? 50;
  const ticks: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max + 1e-9; value += step) {
    ticks.push(Math.round(value * 10) / 10);
  }
  return ticks;
}

export function WeightChart({
  points,
  targetKg,
  today
}: {
  points: TrendPoint[];
  targetKg: number | null;
  today: string;
}) {
  const [range, setRange] = useState<WeightRange>("3m");
  const shown = pointsInRange(points, range, today);
  const rangeDays = WEIGHT_RANGES.find(({ id }) => id === range)?.days ?? null;

  const from = rangeDays === null ? (shown[0]?.day ?? today) : addDays(today, -rangeDays);
  const span = Math.max(1, daysBetween(from, today));

  const values = shown.flatMap(({ kg, trend }) => [kg, trend]);
  let min = Math.min(...values);
  let max = Math.max(...values);
  const pad = Math.max(0.5, (max - min) * 0.1);
  min -= pad;
  max += pad;
  const showTarget = targetKg !== null && targetKg >= min && targetKg <= max;

  const x = (day: string) => PAD.left + (daysBetween(from, day) / span) * PLOT_W;
  const y = (kg: number) => PAD.top + ((max - kg) / (max - min)) * PLOT_H;

  // Trend segments, split at long gaps.
  const segments: TrendPoint[][] = [];
  shown.forEach((point, index) => {
    const previous = shown[index - 1];
    if (!previous || daysBetween(previous.day, point.day) > MAX_LINE_GAP_DAYS) {
      segments.push([point]);
    } else {
      segments.at(-1)!.push(point);
    }
  });

  const last = shown.at(-1);

  return (
    <section
      aria-label="Gráfica de peso"
      className="grid gap-3 rounded-lg border border-line bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">Evolución</h2>
        <div className="flex rounded-lg border border-line p-0.5" role="group">
          {WEIGHT_RANGES.map(({ id, label }) => (
            <button
              aria-pressed={range === id}
              className={`h-10 rounded-md px-3 text-sm font-medium ${
                range === id ? "bg-accent text-white" : "text-ink active:bg-line/50"
              }`}
              key={id}
              onClick={() => setRange(id)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No hay pesajes en este periodo.
        </p>
      ) : (
        <svg
          aria-label={
            last
              ? `Tendencia actual ${formatKg(Math.round(last.trend * 10) / 10)} kg`
              : undefined
          }
          className="h-auto w-full"
          role="img"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
          {yTicks(min, max).map((tick) => (
            <g key={tick}>
              <line
                stroke="#dedbd2"
                strokeWidth={1}
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text
                dominantBaseline="middle"
                fill="#5f6b76"
                fontSize={10}
                textAnchor="end"
                x={PAD.left - 4}
                y={y(tick)}
              >
                {formatKg(tick)}
              </text>
            </g>
          ))}

          {xTicks(from, span).map(({ day, label }) => (
            <text
              fill="#5f6b76"
              fontSize={10}
              key={day}
              textAnchor="middle"
              x={x(day)}
              y={HEIGHT - 6}
            >
              {label}
            </text>
          ))}

          {showTarget ? (
            <g>
              <line
                stroke="#2f7d4f"
                strokeDasharray="4 3"
                strokeOpacity={0.6}
                strokeWidth={1}
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(targetKg)}
                y2={y(targetKg)}
              />
              <text
                fill="#2f7d4f"
                fontSize={10}
                textAnchor="end"
                x={WIDTH - PAD.right}
                y={y(targetKg) - 4}
              >
                Objetivo
              </text>
            </g>
          ) : null}

          {shown.map((point) => (
            <circle
              cx={x(point.day)}
              cy={y(point.kg)}
              fill="#5f6b76"
              fillOpacity={0.45}
              key={point.day}
              r={shown.length > 120 ? 1.8 : 2.6}
            />
          ))}

          {segments.map((segment) =>
            segment.length > 1 ? (
              <polyline
                fill="none"
                key={segment[0].day}
                points={segment
                  .map(
                    (point) => `${x(point.day).toFixed(1)},${y(point.trend).toFixed(1)}`
                  )
                  .join(" ")}
                stroke="#2f7d4f"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
              />
            ) : (
              <circle
                cx={x(segment[0].day)}
                cy={y(segment[0].trend)}
                fill="#2f7d4f"
                key={segment[0].day}
                r={2.5}
              />
            )
          )}
        </svg>
      )}

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-muted/50" />
          Pesajes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-accent" />
          Tendencia
        </span>
      </p>
    </section>
  );
}
