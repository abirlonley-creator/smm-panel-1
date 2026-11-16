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

  // Allow health check, maintenance status, scheduler tick, and Universal API v2 / public docs
  if (
    pathname === "/api/health" ||
    pathname === "/api/scheduler/tick" ||
    pathname === "/api/system/maintenance" ||
    pathname === "/maintenance" ||
    pathname === "/api-docs" ||
    pathname === "/api/openapi.json" ||
    pathname === "/api/v2" ||
    pathname.startsWith("/api/v2/")
  ) {
    return NextResponse.next();
  }

  // Check for authentication cookies or authorization header
  const sessionToken = request.cookies.get("smm_session_token")?.value;
  const adminCookie = request.cookies.get("smm_admin_auth")?.value;
  const authHeader = request.headers.get("authorization");
  const adminHeader =
    request.headers.get("x-admin-key") ||
    request.headers.get("x-passkey") ||
    request.headers.get("x-session-token") ||
    request.headers.get("x-api-key");

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

  // Strict protection for /admin routes:
  // If a user navigates to /admin, verify admin authentication exists.
  // Normal users who only hold a standard USER session will be redirected to /engagement
  // so they can never view, inspect, or interact with the admin panel.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const isAdmin = Boolean(adminCookie || adminHeader);
    if (!isAdmin) {
      const fallbackUrl = new URL("/engagement", request.url);
      return NextResponse.redirect(fallbackUrl);
    }
  }

  // Strict protection for /api/admin/ endpoints
  if (pathname.startsWith("/api/admin/")) {
    const isAdmin = Boolean(adminCookie || adminHeader);
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
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
