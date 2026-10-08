import { addDays, isValidDay } from "./day";
import { formatKcal } from "./diary";

// Energy in one kilogram of body fat, the usual rule of thumb.
export const KCAL_PER_KG = 7700;

export const SEXES = [
  { id: "female", label: "Mujer" },
  { id: "male", label: "Hombre" }
] as const;

export type Sex = (typeof SEXES)[number]["id"];

export const ACTIVITY_LEVELS = [
  {
    id: "sedentary",
    label: "Sedentaria",
    description: "Trabajo sentado y poco o ningún ejercicio",
    factor: 1.2
  },
  {
    id: "light",
    label: "Ligera",
    description: "Ejercicio suave 1-3 días por semana",
    factor: 1.375
  },
  {
    id: "moderate",
    label: "Moderada",
    description: "Ejercicio 3-5 días por semana",
    factor: 1.55
  },
  {
    id: "active",
    label: "Alta",
    description: "Ejercicio intenso 6-7 días por semana",
    factor: 1.725
  },
  {
    id: "veryActive",
    label: "Muy alta",
    description: "Trabajo físico o entrenas dos veces al día",
    factor: 1.9
  }
] as const;

export type Activity = (typeof ACTIVITY_LEVELS)[number]["id"];

export const PACES = [
  { id: "maintain", label: "Mantener", kgPerWeek: 0 },
  { id: "gentle", label: "Suave", kgPerWeek: 0.25 },
  { id: "moderate", label: "Moderado", kgPerWeek: 0.5 },
  { id: "fast", label: "Rápido", kgPerWeek: 0.75 }
] as const;

export type Pace = (typeof PACES)[number]["id"];

/** Safety floor: the target never goes below this. */
export const MIN_TARGET_KCAL: Record<Sex, number> = { female: 1200, male: 1500 };

/** Losing more than this share of body weight per week triggers a warning. */
export const MAX_WEEKLY_LOSS_RATIO = 0.01;

export function isSex(value: unknown): value is Sex {
  return SEXES.some(({ id }) => id === value);
}

export function isActivity(value: unknown): value is Activity {
  return ACTIVITY_LEVELS.some(({ id }) => id === value);
}

export function isPace(value: unknown): value is Pace {
  return PACES.some(({ id }) => id === value);
}

function activityOf(id: Activity) {
  return ACTIVITY_LEVELS.find((level) => level.id === id)!;
}

function paceOf(id: Pace) {
  return PACES.find((pace) => pace.id === id)!;
}

/** Full years between a birth date and a day, both YYYY-MM-DD. */
export function ageOn(birthDate: string, day: string): number {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [year, month, date] = day.split("-").map(Number);
  const hadBirthday = month > birthMonth || (month === birthMonth && date >= birthDay);
  return year - birthYear - (hadBirthday ? 0 : 1);
}

/** Mifflin-St Jeor basal metabolic rate, in kcal/day (not rounded). */
export function basalMetabolicRate({
  sex,
  weightKg,
  heightCm,
  age
}: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

/** kcal/day needed to lose this many kg per week (7.700 kcal per kg). */
export function dailyDeficit(kgPerWeek: number): number {
  return (kgPerWeek * KCAL_PER_KG) / 7;
}

export type TargetInput = {
  sex: Sex;
  birthDate: string;
  heightCm: number;
  activity: Activity;
  pace: Pace;
  targetWeightKg: number;
  manualTargetKcal: number | null;
  weightKg: number;
  today: string;
};

export type TargetResult = {
  age: number;
  bmr: number;
  tdee: number;
  /** Deficit asked for by the chosen pace. */
  requestedDeficit: number;
  /** Formula target after the safety floor. */
  recommended: number;
  /** What the day is measured against: the manual target if set. */
  target: number;
  isManual: boolean;
  minimum: number;
  /** The formula target was raised to the safety floor. */
  floorApplied: boolean;
  /** Expected loss with the final target, kg/week (0 or less: no loss). */
  kgPerWeek: number;
  /** The expected loss is above 1 % of body weight per week. */
  paceTooFast: boolean;
  estimatedDate: string | null;
  /** Explanations shown under the target, in order of importance. */
  notes: string[];
};

const kgFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

export function formatKg(kg: number): string {
  return kgFormat.format(kg);
}

export function calculateTarget(input: TargetInput): TargetResult {
  const age = ageOn(input.birthDate, input.today);
  const bmrRaw = basalMetabolicRate({ ...input, age });
  const bmr = Math.round(bmrRaw);
  const tdee = Math.round(bmrRaw * activityOf(input.activity).factor);
  const pace = paceOf(input.pace);
  const requestedDeficit = Math.round(dailyDeficit(pace.kgPerWeek));
  const minimum = MIN_TARGET_KCAL[input.sex];
  const notes: string[] = [];

  const formulaTarget = tdee - requestedDeficit;
  const floorApplied = formulaTarget < minimum;
  const recommended = floorApplied ? minimum : formulaTarget;
  const isManual = input.manualTargetKcal !== null;
  const target = input.manualTargetKcal ?? recommended;

  const deficit = tdee - target;
  const kgPerWeek = Math.round(((deficit * 7) / KCAL_PER_KG) * 100) / 100;
  const paceTooFast = kgPerWeek > input.weightKg * MAX_WEEKLY_LOSS_RATIO;
  const toLose = input.weightKg - input.targetWeightKg;
  const sexLabel = input.sex === "male" ? "hombres" : "mujeres";

  if (isManual) {
    if (target < minimum) {
      notes.push(
        `Tu objetivo manual está por debajo del mínimo recomendado de ${formatKcal(minimum)} kcal para ${sexLabel}.`
      );
    }
  } else if (floorApplied) {
    notes.push(
      `Con el ritmo ${pace.label.toLowerCase()} te tocarían ${formatKcal(formulaTarget)} kcal, ` +
        `por debajo del mínimo de ${formatKcal(minimum)} kcal para ${sexLabel}. ` +
        `El objetivo se queda en ${formatKcal(minimum)} kcal, ` +
        (kgPerWeek > 0
          ? `así que bajarás unos ${formatKg(kgPerWeek)} kg por semana en lugar de ${formatKg(pace.kgPerWeek)}.`
          : "así que con tu gasto actual no habrá déficit.")
    );
  }

  if (paceTooFast) {
    notes.push(
      `Bajar ${formatKg(kgPerWeek)} kg por semana es más del 1 % de tu peso. ` +
        "Un ritmo más suave es más fácil de mantener y conserva más músculo."
    );
  }

  let estimatedDate: string | null = null;
  if (toLose > 0) {
    if (deficit > 0) {
      estimatedDate = addDays(input.today, Math.ceil((toLose * KCAL_PER_KG) / deficit));
    } else if (!isManual && input.pace === "maintain") {
      notes.push("Con el ritmo «Mantener» no hay fecha estimada para tu peso objetivo.");
    } else if (isManual || !floorApplied) {
      // (When the floor removed the deficit, the note above already says so.)
      notes.push("Con este objetivo no hay déficit: no llegarás a tu peso objetivo.");
    }
  } else if (input.pace !== "maintain" && !isManual) {
    notes.push("Ya estás en tu peso objetivo: quizá te convenga el ritmo «Mantener».");
  }

  return {
    age,
    bmr,
    tdee,
    requestedDeficit,
    recommended,
    target,
    isManual,
    minimum,
    floorApplied,
    kgPerWeek,
    paceTooFast,
    estimatedDate,
    notes
  };
}

export type DayProgress = {
  consumed: number;
  target: number;
  /** Negative when over the target. */
  remaining: number;
  over: boolean;
  /** 0-1, for the progress bar. */
  fill: number;
};

export function dayProgress(consumed: number, target: number): DayProgress {
  const remaining = target - consumed;
  return {
    consumed,
    target,
    remaining,
    over: remaining < 0,
    fill: target > 0 ? Math.min(1, Math.max(0, consumed / target)) : 1
  };
}

// Profile form -----------------------------------------------------------

export const MIN_AGE = 18;
export const MAX_AGE = 100;

export type ProfileInput = {
  sex: Sex;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  activity: Activity;
  pace: Pace;
  manualTargetKcal: number | null;
};

export type ProfileFormValues = Record<
  | "sex"
  | "birthDate"
  | "heightCm"
  | "weightKg"
  | "targetWeightKg"
  | "activity"
  | "pace"
  | "manualTargetKcal",
  string
>;

export type ProfileInputResult =
  | { ok: true; value: ProfileInput }
  | { ok: false; error: string; field: keyof ProfileFormValues };

/** "82", "82,4" or "82.4"; null when it is not a plain positive number. */
export function parseDecimal(value: unknown): number | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d+([.,]\d+)?$/.test(text)) return null;
  return Number(text.replace(",", "."));
}

function inRange(value: number | null, min: number, max: number): value is number {
  return value !== null && value >= min && value <= max;
}

const roundTo1 = (value: number) => Math.round(value * 10) / 10;

export function parseProfileInput(
  raw: Partial<Record<keyof ProfileFormValues, unknown>>,
  today: string
): ProfileInputResult {
  if (!isSex(raw.sex)) return { ok: false, error: "Elige tu sexo.", field: "sex" };

  if (!isValidDay(raw.birthDate)) {
    return { ok: false, error: "Escribe tu fecha de nacimiento.", field: "birthDate" };
  }
  const age = ageOn(raw.birthDate, today);
  if (age < MIN_AGE || age > MAX_AGE) {
    return {
      ok: false,
      error: `La fórmula es para adultos de ${MIN_AGE} a ${MAX_AGE} años.`,
      field: "birthDate"
    };
  }

  const heightCm = parseDecimal(raw.heightCm);
  if (!inRange(heightCm, 120, 230)) {
    return {
      ok: false,
      error: "Escribe tu altura en centímetros (120-230).",
      field: "heightCm"
    };
  }

  const weightKg = parseDecimal(raw.weightKg);
  if (!inRange(weightKg, 30, 300)) {
    return {
      ok: false,
      error: "Escribe tu peso actual en kg (30-300).",
      field: "weightKg"
    };
  }

  const targetWeightKg = parseDecimal(raw.targetWeightKg);
  if (!inRange(targetWeightKg, 30, 300)) {
    return {
      ok: false,
      error: "Escribe tu peso objetivo en kg (30-300).",
      field: "targetWeightKg"
    };
  }

  if (!isActivity(raw.activity)) {
    return { ok: false, error: "Elige tu nivel de actividad.", field: "activity" };
  }
  if (!isPace(raw.pace)) return { ok: false, error: "Elige un ritmo.", field: "pace" };

  let manualTargetKcal: number | null = null;
  const manualText =
    typeof raw.manualTargetKcal === "string" ? raw.manualTargetKcal.trim() : "";
  if (manualText) {
    const manual = parseDecimal(manualText);
    if (!inRange(manual, 800, 6000)) {
      return {
        ok: false,
        error: "El objetivo manual tiene que estar entre 800 y 6.000 kcal.",
        field: "manualTargetKcal"
      };
    }
    manualTargetKcal = Math.round(manual);
  }

  return {
    ok: true,
    value: {
      sex: raw.sex,
      birthDate: raw.birthDate,
      heightCm: roundTo1(heightCm),
      weightKg: roundTo1(weightKg),
      targetWeightKg: roundTo1(targetWeightKg),
      activity: raw.activity,
      pace: raw.pace,
      manualTargetKcal
    }
  };
}
