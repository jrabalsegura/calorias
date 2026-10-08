"use server";

import { revalidatePath } from "next/cache";
import { dayInMadrid } from "@/domain/day";
import { parseWeightInput } from "@/domain/weight";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Saves the weigh-in of a day, replacing the one already there. */
export async function saveWeight(values: {
  day: string;
  kg: string;
}): Promise<{ error: string } | null> {
  await requireCurrentUser();

  const parsed = parseWeightInput(values, dayInMadrid());
  if (!parsed.ok) return { error: parsed.error };

  const { day, kg } = parsed.value;
  await prisma.weightEntry.upsert({
    where: { day },
    create: { day, kg },
    update: { kg }
  });

  // The target on every screen depends on the trend weight.
  revalidatePath("/", "layout");
  return null;
}

export async function deleteWeight(day: string): Promise<{ error: string } | null> {
  await requireCurrentUser();

  // The calorie target needs at least one weigh-in.
  if ((await prisma.weightEntry.count()) <= 1) {
    return { error: "Es tu único pesaje: el objetivo lo necesita." };
  }
  await prisma.weightEntry.deleteMany({ where: { day } });
  revalidatePath("/", "layout");
  return null;
}
