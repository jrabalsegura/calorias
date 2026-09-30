import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken
} from "@/lib/session";

// The manifest, icons and service worker are fetched by the browser without
// the session cookie when installing the app, so they must stay public.
const PUBLIC_PATH_PREFIXES = [
  "/_next",
  "/api/health",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/icons",
  "/login",
  "/manifest.webmanifest",
  "/sw.js"
];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value
  );

  // Proxy runs on Node, so it can check the DB: a password reset or a
  // deleted user revokes existing cookies on the very next request.
  const user = session
    ? await prisma.appUser.findUnique({
        where: { id: session.userId },
        select: { sessionVersion: true }
      })
    : null;

  if (session && user && user.sessionVersion === session.sessionVersion) {
    const response = NextResponse.next();
    const refreshedToken = await createSessionToken(
      session.userId,
      session.sessionVersion
    );

    response.cookies.set(
      SESSION_COOKIE_NAME,
      refreshedToken,
      getSessionCookieOptions()
    );

    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Inicia sesión para continuar." },
      { status: 401 }
    );
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/" || search) {
    loginUrl.searchParams.set("next", `${pathname}${search}`);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
