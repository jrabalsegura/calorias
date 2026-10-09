"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatKcal } from "@/domain/diary";
import {
  ACTIVITY_LEVELS,
  calculateTarget,
  dailyDeficit,
  dayProgress,
  formatKg,
  PACES,
  parseProfileInput,
  SEXES,
  type ProfileFormValues
} from "@/domain/target";
import { saveProfile } from "../(app)/settings/actions";
import { TargetBreakdown } from "./TargetBreakdown";

type Field = keyof ProfileFormValues;

const STEPS: { title: string; fields: Field[] }[] = [
  { title: "Sobre ti", fields: ["sex", "birthDate", "heightCm"] },
  { title: "Tu peso", fields: ["weightKg", "targetWeightKg"] },
  { title: "Actividad y ritmo", fields: ["activity", "pace", "manualTargetKcal"] }
];

/**
 * Profile and goal form. As a wizard (first time) it shows one step at a
 * time; in settings, everything at once. The target preview is recalculated
 * on every change with the same domain code the server uses.
 */
export function ProfileForm({
  initial,
  today,
  consumedToday,
  wizard,
  adaptiveTdee = null,
  adaptiveSince = null
}: {
  initial: ProfileFormValues;
  today: string;
  consumedToday: number;
  wizard: boolean;
  /** Real expenditure of the latest accepted check-in. */
  adaptiveTdee?: number | null;
  adaptiveSince?: string | null;
}) {
  const [values, setValues] = useState(initial);
  const [manual, setManual] = useState(initial.manualTargetKcal !== "");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<{ message: string; field: Field } | null>(null);
  const [isSaving, startSaving] = useTransition();

  const submitted = {
    ...values,
    manualTargetKcal: manual ? values.manualTargetKcal : ""
  };
  const parsed = parseProfileInput(submitted, today);
  const preview = parsed.ok ? calculateTarget({ ...parsed.value, today, adaptiveTdee }) : null;
  const progress = preview ? dayProgress(consumedToday, preview.target) : null;

  const visibleSteps = wizard ? [STEPS[step]] : STEPS;
  const isLastStep = !wizard || step === STEPS.length - 1;

  function set(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (error?.field === field) setError(null);
  }

  function stepOf(field: Field) {
    return STEPS.findIndex(({ fields }) => fields.includes(field));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!parsed.ok && (!wizard || stepOf(parsed.field) <= step)) {
      setError({ message: parsed.error, field: parsed.field });
      if (wizard) setStep(stepOf(parsed.field));
      return;
    }
    if (!isLastStep) {
      setError(null);
      setStep(step + 1);
      window.scrollTo({ top: 0 });
      return;
    }

    startSaving(async () => {
      // Only returns on error: a successful save redirects.
      const result = await saveProfile(submitted);
      setError({ message: result.error, field: result.field });
      if (wizard) setStep(stepOf(result.field));
    });
  }

  const errorFor = (fields: Field[]) =>
    error && fields.includes(error.field) ? (
      <p
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
        role="alert"
      >
        {error.message}
      </p>
    ) : null;

  return (
    <form className="grid gap-4" noValidate onSubmit={onSubmit}>
      {wizard ? (
        <p className="text-sm font-medium text-muted">
          Paso {step + 1} de {STEPS.length}
        </p>
      ) : null}

      {visibleSteps.map(({ title, fields }) => (
        <section
          aria-label={title}
          className="grid gap-4 rounded-lg border border-line bg-white p-4"
          key={title}
        >
          <h2 className="text-lg font-semibold text-ink">{title}</h2>

          {fields.includes("sex") ? (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium text-ink">Sexo</legend>
              <div className="grid grid-cols-2 gap-2">
                {SEXES.map(({ id, label }) => (
                  <Choice
                    value={id}
                    checked={values.sex === id}
                    key={id}
                    label={label}
                    name="sex"
                    onChange={() => set("sex", id)}
                  />
                ))}
              </div>
            </fieldset>
          ) : null}

          {fields.includes("birthDate") ? (
            <label className="field-label">
              Fecha de nacimiento
              <input
                className="field-input"
                max={today}
                name="birthDate"
                onChange={(event) => set("birthDate", event.target.value)}
                type="date"
                value={values.birthDate}
              />
            </label>
          ) : null}

          {fields.includes("heightCm") ? (
            <NumberField
              label="Altura"
              name="heightCm"
              onChange={(value) => set("heightCm", value)}
              placeholder="175"
              unit="cm"
              value={values.heightCm}
            />
          ) : null}

          {fields.includes("weightKg") && wizard ? (
            <NumberField
              hint="Se guarda como tu primer pesaje."
              label="Peso actual"
              name="weightKg"
              onChange={(value) => set("weightKg", value)}
              placeholder="80,5"
              unit="kg"
              value={values.weightKg}
            />
          ) : null}

          {/* After the wizard the weight is the trend of the weigh-ins in Peso. */}
          {fields.includes("weightKg") && !wizard ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">
                Peso actual (tendencia):{" "}
                <span className="font-semibold tabular-nums text-ink">
                  {values.weightKg} kg
                </span>
              </span>
              <Link className="font-semibold text-accent" href="/weight">
                Ir a Peso
              </Link>
            </div>
          ) : null}

          {fields.includes("targetWeightKg") ? (
            <NumberField
              label="Peso objetivo"
              name="targetWeightKg"
              onChange={(value) => set("targetWeightKg", value)}
              placeholder="72"
              unit="kg"
              value={values.targetWeightKg}
            />
          ) : null}

          {fields.includes("activity") ? (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium text-ink">
                Nivel de actividad
              </legend>
              {ACTIVITY_LEVELS.map(({ id, label, description }) => (
                <Choice
                  value={id}
                  checked={values.activity === id}
                  detail={description}
                  key={id}
                  label={label}
                  name="activity"
                  onChange={() => set("activity", id)}
                />
              ))}
            </fieldset>
          ) : null}

          {fields.includes("pace") ? (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium text-ink">Ritmo</legend>
              <div className="grid grid-cols-2 gap-2">
                {PACES.map(({ id, label, kgPerWeek }) => (
                  <Choice
                    value={id}
                    checked={values.pace === id}
                    detail={
                      kgPerWeek === 0
                        ? "Sin déficit"
                        : `${formatKg(kgPerWeek)} kg/sem · −${formatKcal(dailyDeficit(kgPerWeek))}`
                    }
                    key={id}
                    label={label}
                    name="pace"
                    onChange={() => set("pace", id)}
                  />
                ))}
              </div>
            </fieldset>
          ) : null}

          {fields.includes("manualTargetKcal") ? (
            <div className="grid gap-3">
              <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base text-ink">
                <input
                  checked={manual}
                  className="h-5 w-5 accent-accent"
                  onChange={(event) => {
                    setManual(event.target.checked);
                    if (error?.field === "manualTargetKcal") setError(null);
                  }}
                  type="checkbox"
                />
                Fijar el objetivo a mano
              </label>
              {manual ? (
                <NumberField
                  label="Objetivo manual"
                  name="manualTargetKcal"
                  onChange={(value) => set("manualTargetKcal", value)}
                  placeholder={preview ? String(preview.recommended) : "2000"}
                  unit="kcal"
                  value={values.manualTargetKcal}
                />
              ) : null}
            </div>
          ) : null}

          {errorFor(fields)}
        </section>
      ))}

      {isLastStep && preview && progress ? (
        <section
          aria-label="Tu objetivo"
          aria-live="polite"
          className="grid gap-3 rounded-lg border border-line bg-white p-4"
        >
          <TargetBreakdown
            adaptiveSince={adaptiveSince}
            pace={parsed.ok ? parsed.value.pace : "maintain"}
            result={preview}
            today={today}
          />
          <p className="border-t border-line pt-3 text-center text-sm text-muted">
            Hoy llevas {formatKcal(progress.consumed)} kcal:{" "}
            <span
              className={`font-semibold ${progress.over ? "text-red-700" : "text-ink"}`}
            >
              {progress.over
                ? `te pasarías en ${formatKcal(-progress.remaining)} kcal`
                : `te quedarían ${formatKcal(progress.remaining)} kcal`}
            </span>
          </p>
        </section>
      ) : null}

      <div className="flex gap-2">
        {wizard && step > 0 ? (
          <button
            className="secondary-button flex-1"
            onClick={() => {
              setError(null);
              setStep(step - 1);
            }}
            type="button"
          >
            Atrás
          </button>
        ) : null}
        <button className="primary-button flex-[2]" disabled={isSaving} type="submit">
          {isSaving
            ? "Guardando..."
            : !isLastStep
              ? "Siguiente"
              : wizard
                ? "Empezar"
                : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function NumberField({
  label,
  name,
  unit,
  value,
  placeholder,
  hint,
  onChange
}: {
  label: string;
  name: string;
  unit: string;
  value: string;
  placeholder: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field-label">
      {label}
      <span className="relative">
        <input
          autoComplete="off"
          className="field-input pr-14 text-right tabular-nums"
          enterKeyHint="next"
          inputMode="decimal"
          name={name}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="text"
          value={value}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-base text-muted">
          {unit}
        </span>
      </span>
      {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

function Choice({
  name,
  value,
  label,
  detail,
  checked,
  onChange
}: {
  name: string;
  value: string;
  label: string;
  detail?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="relative">
      <input
        checked={checked}
        className="peer sr-only"
        name={name}
        onChange={onChange}
        type="radio"
        value={value}
      />
      <span className="flex min-h-12 cursor-pointer flex-col justify-center rounded-lg border border-line bg-white px-3 py-2 text-ink peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:ring-1 peer-checked:ring-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
        <span className="text-sm font-semibold">{label}</span>
        {detail ? <span className="text-xs text-muted">{detail}</span> : null}
      </span>
    </label>
  );
}
