import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPasswordArgon2, createSession } from "@/lib/auth/passkey-service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { authRateLimiter, getClientIp } from "@/lib/security/redis";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { isDisposableEmail, isValidEmailFormat } from "@/lib/security/disposable-email";
import { sendTelegramSecurityAlert } from "@/lib/security/telegram";
import { cookies } from "next/headers";
import { z } from "zod";

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be under 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  email: z.string().optional().or(z.literal("")),
  turnstileToken: z.string().optional(),
});

export async function POST(request: Request) {
  const clientIp = getClientIp(request);

  // 1. Distributed Rate Limiting via Upstash Redis (5 requests per 60 seconds per IP)
  try {
    const rateLimit = await authRateLimiter.limit(`register:${clientIp}`);
    if (!rateLimit.success) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000));
      return NextResponse.json(
        {
          success: false,
          error: "Too many registration attempts. Please wait a moment before trying again.",
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
    console.error("[RateLimiter Error]:", err);
    // Graceful fallback: continue if Redis is temporarily unreachable
  }

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const errorMsg = parsed.error.issues?.[0]?.message || "Invalid registration data";
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }

    const cleanUsername = parsed.data.username.toLowerCase().trim();
    const { password, email, turnstileToken } = parsed.data;

    // 2. Cloudflare Turnstile Human Verification
    if (turnstileToken) {
      const turnstile = await verifyTurnstileToken(turnstileToken, clientIp);
      if (!turnstile.success) {
        return NextResponse.json(
          { success: false, error: "Bot verification challenge failed. Please refresh and try again." },
          { status: 400 }
        );
      }
    }

    // 3. Disposable and Temporary Email Domain Blocker
    if (email && email.trim().length > 0) {
      const cleanEmail = email.trim().toLowerCase();
      if (!isValidEmailFormat(cleanEmail)) {
        return NextResponse.json(
          { success: false, error: "Please provide a valid email address." },
          { status: 400 }
        );
      }
      if (isDisposableEmail(cleanEmail)) {
        return NextResponse.json(
          { success: false, error: "Temporary and disposable email providers are prohibited. Please use a permanent email." },
          { status: 400 }
        );
      }
    }

    // Check if username is already taken (case-insensitive)
    const existing = await prisma.user.findFirst({
      where: {
        username: { equals: cleanUsername, mode: "insensitive" },
      },
      include: { passkeys: true },
    });

    if (existing) {
      if (existing.passkeys && existing.passkeys.length > 0) {
        return NextResponse.json(
          { success: false, error: "This username is already taken. Please choose another or sign in." },
          { status: 409 }
        );
      }
      // Clean up orphaned user record and its relations from prior aborted attempt
      await prisma.session.deleteMany({ where: { userId: existing.id } }).catch(() => {});
      await prisma.userProviderConnection.deleteMany({ where: { userId: existing.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: existing.id } }).catch(() => {});
    }

    // 4. Memory-hard Argon2id password hash (RFC 9106)
    const keyHash = await hashPasswordArgon2(password);

    // Atomically create User, Provider Connection, and Passkey
    const { user, passkeyRecord } = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: cleanUsername,
          role: "USER",
          status: "ACTIVE",
          walletBalance: 0.0,
        },
      });

      await tx.userProviderConnection.create({
        data: {
          userId: newUser.id,
          name: "Primary Delivery Engine",
          apiUrl: "https://api.internal/v2",
          isMock: true,
          active: true,
          currency: "INR",
        },
      });

      const newPasskey = await tx.passkey.create({
        data: {
          userId: newUser.id,
          label: "Account Password",
          keyPrefix: `usr_${cleanUsername.slice(0, 4)}`,
          keyHash,
          role: "USER",
          status: "ACTIVE",
          expiresAt: null, // User login credentials do not expire
        },
      });

      return { user: newUser, passkeyRecord: newPasskey };
    });

    // Create session and set HTTP-only cookie for immediate login
    const session = await createSession(user.id, passkeyRecord.id);

    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
      path: "/",
    });

    // 5. Out-of-band Security Alert
    sendTelegramSecurityAlert({
      title: "New Account Registered",
      details: `User: ${cleanUsername} registered successfully with Argon2id protection.`,
      severity: "INFO",
      ip: clientIp,
      userAgent: request.headers.get("user-agent") || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        walletBalance: user.walletBalance,
      },
      message: "Account created successfully! Welcome to AuraSMM.",
    });
  } catch (error: any) {
    console.error("[REGISTER_ERROR]", error);
    const isUniqueCollision =
      error?.code === "P2002" ||
      String(error?.message || "").includes("Unique constraint failed") ||
      String(error?.message || "").includes("keyHash");

    if (isUniqueCollision) {
      return NextResponse.json(
        { success: false, error: "An account with these credentials already exists. Please choose a different username or sign in." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || "Failed to create account" },
      { status: 500 }
    );
  }
}
