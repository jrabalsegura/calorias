import { FoodForm } from "../../../components/FoodForm";
import { PageHeader } from "../../../components/PageHeader";
import { MAX_FOOD_NAME_LENGTH } from "@/domain/food";
import { getSafeRedirectPath } from "@/domain/redirect";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { next?: string | string[]; name?: string | string[] };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** New food. With ?next= (from *Añadir*) it goes back there with the food open. */
export default async function NewFoodPage({ searchParams }: { searchParams?: Promise<Params> }) {
  await requireCurrentUser();

  const params = await searchParams;
  const next = first(params?.next) ? getSafeRedirectPath(first(params?.next)) : null;

  return (
    <>
      <PageHeader
        backHref={next ?? "/foods"}
        backLabel={next ? "Volver a Añadir" : "Volver a Mis alimentos"}
        title="Nuevo alimento"
      />
      <FoodForm
        food={null}
        initialName={(first(params?.name) ?? "").slice(0, MAX_FOOD_NAME_LENGTH)}
        next={next}
      />
    </>
  );
}
