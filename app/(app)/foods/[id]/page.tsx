import { notFound } from "next/navigation";
import { FoodForm } from "../../../components/FoodForm";
import { PageHeader } from "../../../components/PageHeader";
import { getSafeRedirectPath } from "@/domain/redirect";
import { requireCurrentUser } from "@/lib/auth";
import { foodSelect, toLibraryFood } from "@/lib/foods";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = { next?: string | string[] };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** Edits a food. With ?next= (from the scanner) it goes back there with the food open. */
export default async function EditFoodPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  await requireCurrentUser();

  const { id } = await params;
  const requestedNext = first((await searchParams)?.next);
  const next = requestedNext ? getSafeRedirectPath(requestedNext) : null;
  const row = await prisma.food.findUnique({ where: { id }, select: foodSelect });
  if (!row) notFound();

  return (
    <>
      <PageHeader
        backHref={next ?? "/foods"}
        backLabel={next ? "Volver" : "Volver a Mis alimentos"}
        title="Editar alimento"
      />
      <FoodForm food={toLibraryFood(row)} initialName="" next={next} />
    </>
  );
}
