export function EmptyScreen({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <section className="rounded-lg border border-dashed border-line bg-white px-4 py-10 text-center text-sm leading-6 text-muted">
        {description}
      </section>
    </>
  );
}
