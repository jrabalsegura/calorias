"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  addDays,
  dayInMadrid,
  formatLongDay,
  formatRelativeDay,
  isValidDay
} from "@/domain/day";

function dayHref(day: string, today: string) {
  return day === today ? "/" : `/?day=${day}`;
}

export function DayNav({ day, today }: { day: string; today: string }) {
  const router = useRouter();
  const isToday = day === today;
  const previous = addDays(day, -1);
  const next = addDays(day, 1);
  const label = formatRelativeDay(day, today);
  const longLabel = formatLongDay(day, today);

  // The installed app can stay open across midnight: when it comes back to
  // the foreground on a new Madrid day, re-render so "Hoy" is really today.
  useEffect(() => {
    const checkDay = () => {
      if (document.visibilityState === "visible" && dayInMadrid() !== today) {
        router.refresh();
      }
    };
    const interval = window.setInterval(checkDay, 60_000);
    document.addEventListener("visibilitychange", checkDay);
    window.addEventListener("focus", checkDay);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkDay);
      window.removeEventListener("focus", checkDay);
    };
  }, [router, today]);

  return (
    <header className="grid gap-2">
      <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2">
        <Link
          aria-label="Día anterior"
          className="grid h-12 w-12 place-items-center rounded-lg text-ink active:bg-line/50"
          href={dayHref(previous, today)}
        >
          <Chevron direction="left" />
        </Link>

        <label className="relative grid min-h-12 cursor-pointer place-items-center rounded-lg px-2 text-center active:bg-line/50">
          <span className="text-xl font-semibold leading-tight text-ink">
            {label}
          </span>
          {/* "Hoy", "Ayer" and "Mañana" also show the date underneath. */}
          {label.toLowerCase() === longLabel ? null : (
            <span className="text-sm text-muted">{longLabel}</span>
          )}
          <input
            aria-label="Elegir fecha"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(event) => {
              const value = event.target.value;
              if (isValidDay(value)) router.push(dayHref(value, today));
            }}
            type="date"
            value={day}
          />
        </label>

        <Link
          aria-label="Día siguiente"
          className="grid h-12 w-12 place-items-center rounded-lg text-ink active:bg-line/50"
          href={dayHref(next, today)}
        >
          <Chevron direction="right" />
        </Link>
      </div>

      {isToday ? null : (
        <Link className="secondary-button justify-self-center px-5" href="/">
          Volver a hoy
        </Link>
      )}
    </header>
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
