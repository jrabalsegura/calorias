// Only same-origin absolute paths are allowed after login, never back to
// /login itself, so a crafted ?next= cannot send the user to another site.
export function getSafeRedirectPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.startsWith("/login")
  ) {
    return "/";
  }

  return value;
}
