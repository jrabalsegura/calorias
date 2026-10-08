"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dayInMadrid } from "@/domain/day";
import { parseProfileInput, type ProfileFormValues } from "@/domain/target";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PROFILE_ID = "profile";

export async function saveProfile(
  values: ProfileFormValues
): Promise<{ error: string; field: keyof ProfileFormValues }> {
  await requireCurrentUser();

  const today = dayInMadrid();
  const parsed = parseProfileInput(values, today);
  if (!parsed.ok) return { error: parsed.error, field: parsed.field };

  const { weightKg, ...profile } = parsed.value;
  const latestWeight = await prisma.weightEntry.findFirst({ orderBy: { day: "desc" } });
  const isFirstTime = latestWeight === null;

  await prisma.$transaction([
    prisma.profile.upsert({
      where: { id: PROFILE_ID },
      create: { id: PROFILE_ID, ...profile },
      update: profile
    }),
    // The first save stores the starting weight; later ones only add a
    // weigh-in for today when the weight actually changed.
    ...(latestWeight?.kg === weightKg
      ? []
      : [
          prisma.weightEntry.upsert({
            where: { day: today },
            create: { day: today, kg: weightKg },
            update: { kg: weightKg }
          })
        ])
  ]);

  revalidatePath("/", "layout");
  redirect(isFirstTime ? "/" : "/settings");
}
