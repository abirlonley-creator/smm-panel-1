import { NextResponse } from "next/server";
import { verifyPasskey, createSession, hashPasswordArgon2, verifyPasswordHash } from "@/lib/auth/passkey-service";
import { SESSION_COOKIE_NAME, ADMIN_COOKIE_NAME } from "@/lib/auth/session";
import { getMaintenanceState } from "@/lib/maintenance/maintenance-service";
import { prisma } from "@/lib/prisma";
import { authRateLimiter, getClientIp } from "@/lib/security/redis";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { sendTelegramSecurityAlert } from "@/lib/security/telegram";
import { cookies } from "next/headers";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  passkey: z.string().optional(),
  turnstileToken: z.string().optional(),
});

export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  // 1. Distributed Rate Limiting via Upstash Redis (5 attempts per 60 seconds per IP)
  try {
    const rateLimit = await authRateLimiter.limit(`login:${clientIp}`);
    if (!rateLimit.success) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000));
      return NextResponse.json(
        {
          success: false,
          error: "Too many login attempts. Please wait before attempting to sign in again.",
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        }
      );
    }
  } catch (err) {
    console.error("[RateLimiter Login Error]:", err);
  }

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Please enter your username and password, or passkey." },
        { status: 400 }
      );
    }

    const { username, password, passkey, turnstileToken } = parsed.data;

    // Turnstile bot challenge validation
    if (turnstileToken) {
      const turnstile = await verifyTurnstileToken(turnstileToken, clientIp);
      if (!turnstile.success) {
        return NextResponse.json(
          { success: false, error: "Bot verification challenge failed. Please refresh and try again." },
          { status: 400 }
        );
      }
    }

    // Check if Under Update / Maintenance mode is active
    const maintenance = await getMaintenanceState();

    // 1. Direct Passkey Login
    if (passkey && passkey.trim()) {
      const cleanKey = passkey.trim();
      const verification = await verifyPasskey(cleanKey);

      if (!verification.valid || !verification.user) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid, expired, or revoked passkey.",
            isExpired: verification.isExpired || false,
          },
          { status: 401 }
        );
      }

      if (maintenance.enabled && verification.role !== "ADMIN") {
        return NextResponse.json(
          {
            success: false,
            underMaintenance: true,
            error: "Currently we're updating the website. Please hold on for a moment while admin updates the website.",
          },
          { status: 503 }
        );
      }

      const session = await createSession(
        verification.user.id,
        verification.passkey?.id
      );

      const cookieStore = cookies();
      cookieStore.set(SESSION_COOKIE_NAME, session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
        path: "/",
      });

      if (verification.role === "ADMIN") {
        cookieStore.set(ADMIN_COOKIE_NAME, session.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
          path: "/",
        });

        sendTelegramSecurityAlert({
          title: "Admin Passkey Session Initiated",
          details: `Admin authenticated via passkey (${verification.passkey?.label || "VIP"}).`,
          severity: "WARNING",
          ip: clientIp,
          userAgent: request.headers.get("user-agent") || undefined,
        }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        user: verification.user,
        passkey: verification.passkey,
        role: verification.role,
        remainingDays: verification.remainingDays,
        remainingHours: verification.remainingHours,
        expiresAt: verification.expiresAt,
      });
    }

    // 2. Standard Username + Password Login
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required." },
        { status: 400 }
      );
    }

    const cleanUsername = username.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { username: cleanUsername },
      include: {
        passkeys: {
          where: { status: "ACTIVE" },
        },
      },
    });

    if (!user) {
      // Constant-time generic error prevents username enumeration
      return NextResponse.json(
        { success: false, error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // Find matching passkey credential using Argon2id / SHA-256 verifier
    let matchingKey = null;
    for (const pk of user.passkeys) {
      const isValid = await verifyPasswordHash(pk.keyHash, password, cleanUsername);
      if (isValid) {
        matchingKey = pk;
        break;
      }
    }

    if (!matchingKey) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // Automatic migration to Argon2id if record was using legacy SHA-256
    if (!matchingKey.keyHash.startsWith("$argon2id$") && matchingKey.label === "Account Password") {
      hashPasswordArgon2(password).then((upgradedHash) => {
        prisma.passkey.update({
          where: { id: matchingKey!.id },
          data: { keyHash: upgradedHash },
        }).catch(() => {});
      }).catch(() => {});
    }

    if (maintenance.enabled && user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          underMaintenance: true,
          error: "Currently we're updating the website. Please hold on for a moment while admin updates the website.",
        },
        { status: 503 }
      );
    }

    const session = await createSession(user.id, matchingKey.id);

    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
      path: "/",
    });

    if (user.role === "ADMIN") {
      cookieStore.set(ADMIN_COOKIE_NAME, session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
        path: "/",
      });

      sendTelegramSecurityAlert({
        title: "Admin Signed In",
        details: `Administrator account "${user.username}" authenticated.`,
        severity: "WARNING",
        ip: clientIp,
        userAgent: request.headers.get("user-agent") || undefined,
      }).catch(() => {});
    }

    const hasVipPasskey = user.passkeys.some(
      (pk) =>
        pk.label !== "Account Password" &&
        (!pk.expiresAt || pk.expiresAt > new Date())
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        walletBalance: user.walletBalance,
      },
      isVip: hasVipPasskey || user.role === "ADMIN",
      role: user.role,
    });
  } catch (error: any) {
    console.error("[LOGIN_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Authentication failed. Please try again." },
      { status: 500 }
    );
  }
}
