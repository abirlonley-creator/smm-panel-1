import { NextResponse } from "next/server";
import { verifyAdminCredential } from "@/lib/auth/keys";
import { verifyPasskey, createSession } from "@/lib/auth/passkey-service";
import { ADMIN_COOKIE_NAME, SESSION_COOKIE_NAME, getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { adminRateLimiter, getClientIp } from "@/lib/security/redis";
import { sendTelegramSecurityAlert } from "@/lib/security/telegram";
import { cookies } from "next/headers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  key: z.string().min(1, "Access key is required"),
});

export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  // Distributed Rate Limiting for Admin Access
  try {
    const rateLimit = await adminRateLimiter.limit(`admin_auth:${clientIp}`);
    if (!rateLimit.success) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000));
      return NextResponse.json(
        {
          success: false,
          error: "Too many admin login attempts. Access temporarily locked for this IP.",
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        }
      );
    }
  } catch (err) {
    console.error("[Admin RateLimiter Error]:", err);
  }

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Access key is required" },
        { status: 400 }
      );
    }

    const { key } = parsed.data;
    const verification = await verifyAdminCredential(key);

    if (!verification.valid) {
      // Alert administrator about failed admin access attempt
      sendTelegramSecurityAlert({
        title: "Failed Administrator Login Attempt",
        details: `An invalid access key was entered from IP: ${clientIp}`,
        severity: "WARNING",
        ip: clientIp,
        userAgent: request.headers.get("user-agent") || undefined,
      }).catch(() => {});

      return NextResponse.json(
        { success: false, error: "Invalid, expired, or revoked access key." },
        { status: 401 }
      );
    }

    // Resolve or initialize the admin user record
    let adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          username: "admin",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
    }

    // Create a cryptographically random, ephemeral session token
    // (Never write the master key to cookies!)
    let passkeyId: string | undefined = undefined;
    try {
      const passkeyRes = await verifyPasskey(key);
      if (passkeyRes.valid && passkeyRes.passkey) {
        passkeyId = passkeyRes.passkey.id;
      }
    } catch {
      // ignore
    }

    const session = await createSession(adminUser.id, passkeyId);

    const cookieStore = cookies();
    const sessionMaxAge = 60 * 60 * 2; // 2 hours strict session limit

    // Set signed, short-lived session token (not raw secret)
    cookieStore.set(ADMIN_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionMaxAge,
      path: "/",
    });

    cookieStore.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionMaxAge,
      path: "/",
    });

    // Telegram security alert on successful admin sign-in
    sendTelegramSecurityAlert({
      title: "Admin Panel Authenticated",
      details: `Administrator panel unlocked with label: "${verification.label || "Master Admin"}"`,
      severity: "INFO",
      ip: clientIp,
      userAgent: request.headers.get("user-agent") || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      role: verification.role,
      label: verification.label,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Authentication error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  return NextResponse.json({
    authenticated: session.authenticated,
    role: session.role || null,
    label: session.label || null,
  });
}

export async function DELETE() {
  const cookieStore = cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ success: true, message: "Logged out successfully" });
}
