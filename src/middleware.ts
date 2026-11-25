import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function applySecurityHeaders(response: NextResponse): NextResponse {
  // RFC 6797 HTTP Strict Transport Security
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Clickjacking Mitigation
  response.headers.set("X-Frame-Options", "DENY");

  // MIME-Sniffing Prevention
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer Privacy Protection
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Browser Feature Restrictions
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()"
  );

  // Cross-Site Scripting (XSS) & Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://accounts.google.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https: https://lh3.googleusercontent.com",
    "connect-src 'self' https://challenges.cloudflare.com https://accounts.google.com https://oauth2.googleapis.com https://*.supabase.co https://*.upstash.io",
    "frame-src 'self' https://challenges.cloudflare.com https://accounts.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
  ].join("; ");

  response.headers.set("Content-Security-Policy", cspDirectives);

  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets, images, and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/whop-logo.png") ||
    pathname.startsWith("/fonts") ||
    pathname === "/manifest.json" ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".avif") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  // Allow public landing page, authentication endpoints, and login/signup
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/admin" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/register") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/session") ||
    pathname.startsWith("/api/auth/google") ||
    pathname.startsWith("/api/admin/auth")
  ) {
    return applySecurityHeaders(NextResponse.next());
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
    return applySecurityHeaders(NextResponse.next());
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

  const hasCredential = Boolean(
    (sessionToken && sessionToken.trim().length >= 10) ||
    (adminCookie && adminCookie.trim().length >= 6) ||
    authHeader ||
    adminHeader
  );

  // If unauthenticated:
  if (!hasCredential) {
    if (pathname.startsWith("/api/")) {
      return applySecurityHeaders(
        NextResponse.json(
          { success: false, error: "Authentication required. Please sign in." },
          { status: 401 }
        )
      );
    }

    // Redirect to login page for browser navigation
    const loginUrl = new URL("/login", request.url);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  // Strict protection for /admin routes:
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const hasAdminToken = Boolean(
      (adminCookie && adminCookie.trim().length >= 6) ||
      (adminHeader && adminHeader.trim().length >= 6)
    );
    if (!hasAdminToken) {
      const fallbackUrl = new URL("/engagement", request.url);
      return applySecurityHeaders(NextResponse.redirect(fallbackUrl));
    }
  }

  // Strict protection for /api/admin/ endpoints (excluding the auth route)
  if (pathname.startsWith("/api/admin/") && !pathname.startsWith("/api/admin/auth")) {
    const hasAdminToken = Boolean(
      (adminCookie && adminCookie.trim().length >= 6) ||
      (adminHeader && adminHeader.trim().length >= 6)
    );
    if (!hasAdminToken) {
      return applySecurityHeaders(
        NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
      );
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
