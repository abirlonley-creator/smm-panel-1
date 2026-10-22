import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets, images, and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/whop-logo.png") ||
    pathname.startsWith("/fonts") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  // Allow public authentication endpoints and login page
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout")
  ) {
    return NextResponse.next();
  }

  // Allow health check endpoint for monitoring probes
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  // Check for authentication cookies or authorization header
  const sessionToken = request.cookies.get("smm_session_token")?.value;
  const adminCookie = request.cookies.get("smm_admin_auth")?.value;
  const authHeader = request.headers.get("authorization");
  const adminHeader = request.headers.get("x-admin-key") || request.headers.get("x-passkey") || request.headers.get("x-session-token");

  const hasCredential = Boolean(sessionToken || adminCookie || authHeader || adminHeader);

  // If unauthenticated:
  if (!hasCredential) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Authentication required. Please provide a valid passkey." },
        { status: 401 }
      );
    }

    // Redirect to login page for browser navigation
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
