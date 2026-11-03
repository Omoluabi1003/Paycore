import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth0, auth0Configured } from "./lib/server/auth0";
export async function middleware(request: NextRequest) {
  if (!auth0Configured()) {
    if (request.nextUrl.pathname.startsWith("/auth/"))
      return NextResponse.json(
        { error: "Secure account connection is not configured." },
        { status: 503 },
      );
    return NextResponse.next();
  }
  return auth0().middleware(request);
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|woff2?)$).*)",
  ],
};
