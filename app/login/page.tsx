import { getSafeRedirectPath } from "@/domain/redirect";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = Array.isArray(params?.next) ? params.next[0] : params?.next;

  return (
    <main className="grid min-h-dvh place-items-center px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <section className="grid w-full max-w-sm gap-6 rounded-lg border border-line bg-white p-5 shadow-sm">
        <header className="grid gap-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Calorías
          </p>
          <h1 className="text-2xl font-semibold text-ink">Iniciar sesión</h1>
        </header>

        <LoginForm nextPath={getSafeRedirectPath(next)} />
      </section>
    </main>
  );
}
