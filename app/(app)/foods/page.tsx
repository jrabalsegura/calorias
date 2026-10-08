import { FoodLibrary } from "../../components/FoodLibrary";
import { PageHeader } from "../../components/PageHeader";
import { requireCurrentUser } from "@/lib/auth";
import { loadAllFoods } from "@/lib/foods";

export const dynamic = "force-dynamic";

export default async function FoodsPage() {
  await requireCurrentUser();

  const foods = await loadAllFoods();

  return (
    <>
      <PageHeader backHref="/settings" backLabel="Volver a Ajustes" title="Mis alimentos" />
      <FoodLibrary foods={foods} />
    </>
  );
}
