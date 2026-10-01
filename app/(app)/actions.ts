"use server";

import { revalidatePath } from "next/cache";
import { isValidDay } from "@/domain/day";
import { parseEntryInput } from "@/domain/diary";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type EntryFormState = {
  status: "idle" | "error" | "saved";
  message: string;
  // Changes on every successful save so the sheet knows when to close.
  savedAt: number;
  // What was sent, so a rejected form is shown again as the user left it.
  values?: { kcal: string; name: string; meal: string };
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function saveEntry(
  _previousState: EntryFormState,
  formData: FormData
): Promise<EntryFormState> {
  await requireCurrentUser();

  const id = field(formData, "id");
  const day = field(formData, "day");
  const values = {
    kcal: field(formData, "kcal"),
    name: field(formData, "name"),
    meal: field(formData, "meal")
  };
  const parsed = parseEntryInput(values);

  if (!parsed.ok) {
    return { status: "error", message: parsed.error, savedAt: 0, values };
  }

  if (id) {
    // Editing only touches what the quick entry shows; the day stays put.
    const { count } = await prisma.diaryEntry.updateMany({
      where: { id },
      data: parsed.value
    });
    if (count === 0) {
      return {
        status: "error",
        message: "Esta entrada ya no existe. Recarga la página.",
        savedAt: 0
      };
    }
  } else {
    if (!isValidDay(day)) {
      return { status: "error", message: "Fecha no válida.", savedAt: 0, values };
    }
    await prisma.diaryEntry.create({
      data: { ...parsed.value, day, source: "manual" }
    });
  }

  revalidatePath("/");
  return { status: "saved", message: "", savedAt: Date.now() };
}

export async function deleteEntry(id: string): Promise<void> {
  await requireCurrentUser();

  await prisma.diaryEntry.deleteMany({ where: { id } });
  revalidatePath("/");
}
