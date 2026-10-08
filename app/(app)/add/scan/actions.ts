"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { lookupBarcode, normalizeBarcode, type BarcodeLookup } from "@/domain/barcode";
import { requireCurrentUser } from "@/lib/auth";
import { loadFoodForAdding, type LibraryFood } from "@/lib/foods";
import { fetchOffProduct } from "@/lib/openFoodFacts";
import { prisma } from "@/lib/prisma";

export type ScanResult =
  | BarcodeLookup<LibraryFood>
  | { kind: "error"; error: string; barcode: string | null };

async function foodIdByBarcode(barcode: string): Promise<string | null> {
  const row = await prisma.food.findUnique({
    where: { barcode },
    select: { id: true, archived: true }
  });
  if (!row) return null;
  // Scanning an archived product is asking for it again.
  if (row.archived) {
    await prisma.food.update({ where: { id: row.id }, data: { archived: false } });
  }
  return row.id;
}

/**
 * Finds a scanned or typed barcode in the library or, failing that, in Open
 * Food Facts; a product with usable data is saved to the library.
 */
export async function scanBarcode(raw: string, format?: string): Promise<ScanResult> {
  await requireCurrentUser();

  const barcode = normalizeBarcode(raw, format);
  if (!barcode) {
    return { kind: "error", error: "Ese código no es válido: revisa el número.", barcode: null };
  }

  let changed = false;
  try {
    const result = await lookupBarcode<LibraryFood>(barcode, {
      findFood: async (code) => {
        const id = await foodIdByBarcode(code);
        return id ? loadFoodForAdding(id) : null;
      },
      fetchOff: fetchOffProduct,
      createFood: async ({ portions, ...data }) => {
        let id: string;
        try {
          ({ id } = await prisma.food.create({
            data: {
              ...data,
              source: "barcode",
              portions: {
                create: portions.map((portion, position) => ({ ...portion, position }))
              }
            },
            select: { id: true }
          }));
        } catch (error) {
          // Saved meanwhile (a double scan): use that one.
          const existing =
            error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
              ? await foodIdByBarcode(data.barcode)
              : null;
          if (!existing) throw error;
          id = existing;
        }
        changed = true;
        return (await loadFoodForAdding(id))!;
      }
    });
    if (changed) revalidatePath("/", "layout");
    return result;
  } catch (error) {
    console.error(`[scan] ${barcode}:`, error);
    return {
      kind: "error",
      error: "No se pudo consultar Open Food Facts. Prueba otra vez o créalo a mano.",
      barcode
    };
  }
}
