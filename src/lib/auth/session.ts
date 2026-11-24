import { cookies } from "next/headers";
import { validateSession, verifyPasskey, initDefaultAdminPasskey } from "./passkey-service";

export const SESSION_COOKIE_NAME = "smm_session_token";
export const ADMIN_COOKIE_NAME = "smm_admin_auth";

export interface AuthSessionResult {
  authenticated: boolean;
  user?: {
    id: string;
    username: string;
    role: string;
    status: string;
    providerConfig?: {
      id: string;
      name: string;
      apiUrl: string;
      hasApiKey: boolean;
      isMock: boolean;
      balance: number | null;
      currency: string;
      lastSyncAt: Date | null;
    } | null;
  };
  passkey?: {
    id: string;
    label: string;
    role: string;
    status: string;
    expiresAt: Date | null;
    durationDays: number | null;
  } | null;
  role?: string;
  label?: string;
  remainingDays?: number | null;
  remainingHours?: number | null;
  isExpired?: boolean;
}

/**
 * Resolves authenticated user session from headers or HTTP-only cookies.
 */
export async function getAuthSession(request?: Request): Promise<AuthSessionResult> {
  // 1. Check custom headers
  if (request) {
    const sessionHeader = request.headers.get("x-session-token");
    if (sessionHeader) {
      const sessionRes = await validateSession(sessionHeader.trim());
      if (sessionRes.valid && sessionRes.user) {
        return {
          authenticated: true,
          user: sessionRes.user,
          passkey: sessionRes.passkey,
          role: sessionRes.role,
          label: sessionRes.passkey?.label || sessionRes.user.username,
          remainingDays: sessionRes.remainingDays,
          remainingHours: sessionRes.remainingHours,
        };
      }
    }

    const customHeader = request.headers.get("x-admin-key") || request.headers.get("x-passkey");
    if (customHeader) {
      const res = await verifyPasskey(customHeader.trim());
      if (res.valid && res.user) {
        return {
          authenticated: true,
          user: res.user,
          passkey: res.passkey,
          role: res.role,
          label: res.passkey?.label || res.user.username,
          remainingDays: res.remainingDays,
          remainingHours: res.remainingHours,
        };
      }
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const keyOrToken = authHeader.replace("Bearer ", "").trim();
      // Try as session token first
      const sessionRes = await validateSession(keyOrToken);
      if (sessionRes.valid && sessionRes.user) {
        return {
          authenticated: true,
          user: sessionRes.user,
          passkey: sessionRes.passkey,
          role: sessionRes.role,
          label: sessionRes.passkey?.label || sessionRes.user.username,
          remainingDays: sessionRes.remainingDays,
          remainingHours: sessionRes.remainingHours,
        };
      }

      // Try as raw passkey
      const keyRes = await verifyPasskey(keyOrToken);
      if (keyRes.valid && keyRes.user) {
        return {
          authenticated: true,
          user: keyRes.user,
          passkey: keyRes.passkey,
          role: keyRes.role,
          label: keyRes.passkey?.label || keyRes.user.username,
          remainingDays: keyRes.remainingDays,
          remainingHours: keyRes.remainingHours,
        };
      }
    }
  }

  // 2. Check cookies (direct header parse first for speed and edge safety, fallback to cookieStore)
  let sessionToken: string | undefined = undefined;
  let adminToken: string | undefined = undefined;

  if (request) {
    const rawCookies = request.headers.get("cookie");
    if (rawCookies) {
      const parsed = Object.fromEntries(
        rawCookies
          .split(";")
          .map((c) => {
            const idx = c.indexOf("=");
            if (idx === -1) return [];
            return [c.slice(0, idx).trim(), decodeURIComponent(c.slice(idx + 1).trim())];
          })
          .filter((pair) => pair.length === 2)
      );
      sessionToken = parsed[SESSION_COOKIE_NAME];
      adminToken = parsed[ADMIN_COOKIE_NAME];
    }
  }

  if (!sessionToken && !adminToken) {
    try {
      const cookieStore = cookies();
      sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    } catch {
      // Non-request context
    }
  }

  if (sessionToken) {
    const sessionRes = await validateSession(sessionToken.trim());
    if (sessionRes.valid && sessionRes.user) {
      return {
        authenticated: true,
        user: sessionRes.user,
        passkey: sessionRes.passkey,
        role: sessionRes.role,
        label: sessionRes.passkey?.label || sessionRes.user.username,
        remainingDays: sessionRes.remainingDays,
        remainingHours: sessionRes.remainingHours,
      };
    }
  }

  if (adminToken) {
    const sessionRes = await validateSession(adminToken.trim());
    if (sessionRes.valid && sessionRes.user) {
      return {
        authenticated: true,
        user: sessionRes.user,
        passkey: sessionRes.passkey,
        role: sessionRes.role,
        label: sessionRes.passkey?.label || sessionRes.user.username,
        remainingDays: sessionRes.remainingDays,
        remainingHours: sessionRes.remainingHours,
      };
    }

    const keyRes = await verifyPasskey(adminToken.trim());
    if (keyRes.valid && keyRes.user) {
      return {
        authenticated: true,
        user: keyRes.user,
        passkey: keyRes.passkey,
        role: keyRes.role,
        label: keyRes.passkey?.label || keyRes.user.username,
        remainingDays: keyRes.remainingDays,
        remainingHours: keyRes.remainingHours,
      };
    }
  }

  return { authenticated: false };
}

/**
 * Validates whether the incoming request has valid admin credentials.
 * Ensures the role is strictly ADMIN.
 */
export async function getAdminSession(request?: Request): Promise<{
  authenticated: boolean;
  role?: string;
  label?: string;
  user?: any;
}> {
  const session = await getAuthSession(request);

  if (!session.authenticated || session.role !== "ADMIN") {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    role: session.role,
    label: session.label || "Admin",
    user: session.user,
  };
}
