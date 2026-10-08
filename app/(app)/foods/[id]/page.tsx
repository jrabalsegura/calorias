import { notFound } from "next/navigation";
import { FoodForm } from "../../../components/FoodForm";
import { PageHeader } from "../../../components/PageHeader";
import { requireCurrentUser } from "@/lib/auth";
import { foodSelect, toLibraryFood } from "@/lib/foods";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditFoodPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCurrentUser();

  const { id } = await params;
  const row = await prisma.food.findUnique({ where: { id }, select: foodSelect });
  if (!row) notFound();

  return (
    <>
      <PageHeader backHref="/foods" backLabel="Volver a Mis alimentos" title="Editar alimento" />
      <FoodForm food={toLibraryFood(row)} initialName="" next={null} />
    </>
  );
}
