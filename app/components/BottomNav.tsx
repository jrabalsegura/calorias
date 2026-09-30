"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Hoy", icon: TodayIcon },
  { href: "/weight", label: "Peso", icon: WeightIcon },
  { href: "/summary", label: "Resumen", icon: SummaryIcon },
  { href: "/settings", label: "Ajustes", icon: SettingsIcon }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  active ? "text-accent" : "text-muted"
                }`}
                href={href}
              >
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

function TodayIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
    </Svg>
  );
}

function WeightIcon() {
  return (
    <Svg>
      <rect height="16" rx="3" width="16" x="4" y="4" />
      <path d="M8.5 10a5 5 0 0 1 7 0" />
      <path d="M12 10.5 13.2 8.8" />
    </Svg>
  );
}

function SummaryIcon() {
  return (
    <Svg>
      <path d="M5 19V11" />
      <path d="M12 19V5" />
      <path d="M19 19v-5" />
    </Svg>
  );
}

function SettingsIcon() {
  return (
    <Svg>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 17h2" />
      <path d="M10 17h10" />
      <circle cx="8" cy="17" r="2" />
    </Svg>
  );
}
