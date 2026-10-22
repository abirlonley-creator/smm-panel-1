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
  await initDefaultAdminPasskey();

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

  // 2. Check HTTP-only cookies
  try {
    const cookieStore = cookies();

    // Check modern session token cookie
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
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

    // Check legacy admin cookie (holds raw key or bootstrap)
    const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (adminToken) {
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
  } catch {
    // cookies() might not be available in non-request contexts
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
