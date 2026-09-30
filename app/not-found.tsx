import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <section className="grid max-w-sm gap-4 text-center">
        <h1 className="text-2xl font-semibold text-ink">Página no encontrada</h1>
        <Link className="primary-button" href="/">
          Volver a Hoy
        </Link>
      </section>
    </main>
  );
}
