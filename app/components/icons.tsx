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

export function BarcodeIcon() {
  return (
    <Icon>
      <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
      <path d="M8 8v8M11 8v8M14 8v8M16.5 8v8" />
    </Icon>
  );
}

export function FlashlightIcon({ on }: { on: boolean }) {
  return (
    <Icon fill={on ? "currentColor" : "none"}>
      <path d="M8 3h8v4l-2 3v10a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V10L8 7z" />
      <path d="M8 7h8" />
    </Icon>
  );
}

export function TextIcon() {
  return (
    <Icon>
      <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </Icon>
  );
}

export function TrashIcon() {
  return (
    <Icon className="h-5 w-5">
      <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
    </Icon>
  );
}

export function CameraIcon() {
  return (
    <Icon>
      <path d="M4 8a1 1 0 0 1 1-1h3l1.5-2h5L16 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </Icon>
  );
}
