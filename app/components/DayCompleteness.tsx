"use client";

import { useTransition } from "react";
import { formatKcal } from "@/domain/diary";
import { dayStatus, LOW_KCAL_DAY, type DayMark, type DayRecord } from "@/domain/summary";
import { setDayMark } from "../(app)/actions";

/**
 * Whether the day counts for the summary and the expenditure estimate,
 * with a button to mark it complete or incomplete (or undo the mark).
 */
export function DayCompleteness({ record }: { record: DayRecord }) {
  const [isSaving, startSaving] = useTransition();
  const status = dayStatus(record);
  if (status === "empty") return null;

  const { text, action, mark } = describe(record, status);

  return (
    <section
      aria-label="Día completo"
      className="flex items-center gap-3 rounded-lg border border-line bg-white py-1 pl-4 pr-1"
    >
      <p className={`flex-1 text-sm leading-5 ${status === "counted" ? "text-muted" : "text-ink"}`}>
        {text}
      </p>
      <button
        className="h-12 shrink-0 rounded-lg px-3 text-sm font-semibold text-accent active:bg-line/50 disabled:opacity-60"
        disabled={isSaving}
        onClick={() => startSaving(() => setDayMark(record.day, mark))}
        type="button"
      >
        {action}
      </button>
    </section>
  );
}

function describe(
  record: DayRecord,
  status: "marked" | "low" | "counted"
): { text: string; action: string; mark: DayMark | null } {
  if (status === "marked") {
    return {
      text: "Marcado como incompleto: no cuenta para el resumen.",
      action: "Deshacer",
      mark: null
    };
  }
  if (status === "low") {
    return {
      text: `Con menos de ${formatKcal(LOW_KCAL_DAY)} kcal se toma como incompleto y no cuenta para el resumen.`,
      action: "Está completo",
      mark: "complete"
    };
  }
  if (record.mark === "complete") {
    return { text: "Marcado como completo.", action: "Deshacer", mark: null };
  }
  return { text: "¿Te falta algo por apuntar?", action: "Marcar incompleto", mark: "incomplete" };
}
