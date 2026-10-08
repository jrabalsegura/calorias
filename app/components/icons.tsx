function Icon({
  children,
  className = "h-6 w-6",
  strokeWidth = 2,
  fill = "none"
}: {
  children: React.ReactNode;
  className?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill={fill}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <Icon className={className} strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function BackIcon() {
  return (
    <Icon>
      <path d="m15 5-7 7 7 7" />
    </Icon>
  );
}

export function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <Icon className={className} fill={filled ? "currentColor" : "none"} strokeWidth={1.8}>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </Icon>
  );
}

export function SearchIcon() {
  return (
    <Icon className="h-5 w-5">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Icon>
  );
}

export function RepeatIcon() {
  return (
    <Icon>
      <path d="M17 3l3 3-3 3" />
      <path d="M4 12V9a3 3 0 0 1 3-3h13" />
      <path d="M7 21l-3-3 3-3" />
      <path d="M20 12v3a3 3 0 0 1-3 3H4" />
    </Icon>
  );
}

export function BoltIcon() {
  return (
    <Icon>
      <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />
    </Icon>
  );
}
