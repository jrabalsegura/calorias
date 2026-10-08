import Link from "next/link";
import { BackIcon } from "./icons";

/** Title of a secondary screen with a back link. */
export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel
}: {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <header className="flex items-center gap-1">
      <Link
        aria-label={backLabel}
        className="-ml-3 grid h-12 w-12 shrink-0 place-items-center rounded-lg text-ink active:bg-line/50"
        href={backHref}
      >
        <BackIcon />
      </Link>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
    </header>
  );
}
