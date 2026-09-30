import { requireCurrentUser } from "@/lib/auth";
import { logoutUser } from "../../login/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireCurrentUser();

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink">Ajustes</h1>
      <section className="grid gap-4 rounded-lg border border-line bg-white p-4">
        <div className="grid gap-1">
          <p className="text-sm text-muted">Sesión iniciada como</p>
          <p className="font-semibold text-ink">{user.username}</p>
        </div>
        <form action={logoutUser}>
          <button className="secondary-button w-full" type="submit">
            Cerrar sesión
          </button>
        </form>
      </section>
    </>
  );
}
