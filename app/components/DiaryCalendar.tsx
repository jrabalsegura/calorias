import Link from "next/link";
import { formatLongDay } from "@/domain/day";
import { formatKcal } from "@/domain/diary";
import {
  addMonths,
  dayTone,
  formatMonth,
  monthGrid,
  type DayIndex,
  type DayTone
} from "@/domain/summary";
import { diaryHref } from "./links";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

const TONE_CLASS: Record<DayTone, string> = {
  empty: "text-muted",
  incomplete: "border border-dashed border-muted/60 text-muted",
  counted: "bg-line/60 text-ink",
  within: "bg-emerald-100 text-emerald-900",
  over: "bg-amber-100 text-amber-900",
  wayOver: "bg-red-100 text-red-800"
};

const TONE_LABEL: Record<DayTone, string> = {
  empty: "sin datos",
  incomplete: "incompleto",
  counted: "registrado",
  within: "dentro del objetivo",
  over: "algo por encima",
  wayOver: "por encima"
};

/** A month of the diary coloured by how each day went; a day opens its diary. */
export function DiaryCalendar({
  month,
  days,
  target,
  today
}: {
  month: string;
  days: DayIndex;
  target: number | null;
  today: string;
}) {
  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);
  const hasNext = next <= today.slice(0, 7);

  return (
    <section aria-labelledby="calendar-title" className="grid gap-3 rounded-lg border border-line bg-white p-4">
      <div className="grid grid-cols-[3rem_1fr_3rem] items-center">
        <Link
          aria-label="Mes anterior"
          className="-ml-3 grid h-12 w-12 place-items-center rounded-lg text-ink active:bg-line/50"
          href={`/summary?month=${previous}`}
          scroll={false}
        >
          <Chevron direction="left" />
        </Link>
        <h2 className="text-center font-semibold text-ink" id="calendar-title">
          {formatMonth(month)}
        </h2>
        {hasNext ? (
          <Link
            aria-label="Mes siguiente"
            className="-mr-3 grid h-12 w-12 place-items-center justify-self-end rounded-lg text-ink active:bg-line/50"
            href={`/summary?month=${next}`}
            scroll={false}
          >
            <Chevron direction="right" />
          </Link>
        ) : (
          <span />
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((weekday) => (
          <span className="text-xs font-medium text-muted" key={weekday}>
            {weekday}
          </span>
        ))}
        {monthGrid(month)
          .flat()
          .map((day, index) => {
            if (!day) return <span key={`pad-${index}`} />;
            const number = Number(day.slice(8));
            if (day > today) {
              return (
                <span className="grid h-12 place-items-center text-sm text-muted/50" key={day}>
                  {number}
                </span>
              );
            }
            const record = days.get(day);
            const tone = dayTone(record, target);
            return (
              <Link
                aria-label={`${formatLongDay(day, today)}: ${
                  record ? `${formatKcal(record.kcal)} kcal, ` : ""
                }${TONE_LABEL[tone]}`}
                className={`grid h-12 place-items-center rounded-lg text-sm font-medium tabular-nums active:opacity-70 ${
                  TONE_CLASS[tone]
                } ${day === today ? "ring-2 ring-accent ring-offset-1" : ""}`}
                href={diaryHref(day, today)}
                key={day}
              >
                {number}
              </Link>
            );
          })}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {(target === null
          ? (["counted", "incomplete"] as const)
          : (["within", "over", "wayOver", "incomplete"] as const)
        ).map((tone) => (
          <li className="flex items-center gap-1.5" key={tone}>
            <span className={`inline-block h-3 w-3 rounded ${TONE_CLASS[tone]}`} />
            {tone === "over" ? "hasta +10 %" : TONE_LABEL[tone]}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d={direction === "left" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
    </svg>
  );
}
