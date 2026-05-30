import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";

// Routes that are reachable without authentication.
const PUBLIC_PATHS = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;
  const isAuthed = !!payload;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Signed-in users shouldn't see the auth pages.
  if (isAuthed && isPublic) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Everything else requires a session.
  if (!isAuthed && !isPublic) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Match everything except Next internals, auth API, and static assets
// (incl. /manuscripts images). Auth API stays open so login/register work.
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|manuscripts|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
